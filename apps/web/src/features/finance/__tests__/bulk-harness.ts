import type {
  BulkPutResult,
  BulkRemoveResult,
  CollectionName,
  PersistenceAdapter,
} from "@/core/persistence";
import { persistence } from "@/core/persistence";
import { useStore } from "@/core/store";
import { setPersistAuth } from "@/core/store/persist";
import type { FinanceSlice } from "../store";

/** One write the fake backend saw — what the "one call, not one per row" assertions read. */
export interface WriteCall {
  op: "put" | "bulkPut" | "remove" | "bulkRemove";
  collection: CollectionName;
  rowCount: number;
}

/** How the fake backend answers a call: the chunks it wrote, or a throw. */
export type BackendAnswer = (call: WriteCall) => Promise<{ writtenChunks: number }>;

/** The backend's own chunk sizes: 450 writes to a batch, and a removal costs its row plus a tombstone. */
const CHUNK_ROWS = { bulkPut: 450, bulkRemove: 225 };

export const landsEverything: BackendAnswer = async (call) => ({
  writtenChunks:
    call.op === "bulkPut" || call.op === "bulkRemove"
      ? Math.max(1, Math.ceil(call.rowCount / CHUNK_ROWS[call.op]))
      : 1,
});

export const rejectsWith =
  (error: unknown): BackendAnswer =>
  async () => {
    throw error;
  };

export interface FinanceBulkHarness {
  calls: WriteCall[];
  callsFor: (op: WriteCall["op"], collection: CollectionName) => WriteCall[];
  /** Every write the backend saw, batched or not — the "counter bumps" number a lane reports. */
  countWrites: () => number;
  answerWith: (answer: BackendAnswer) => void;
  /** Hold every call open until the returned release runs — lets a test observe a write in flight. */
  holdCalls: () => () => void;
  /** What a reconciling refetch would pull; unserved collections make the refetch fail harmlessly. */
  serveOnRefetch: (rows: Partial<FinanceSlice>) => void;
  seed: (rows: Partial<FinanceSlice>) => void;
  read: <C extends keyof FinanceSlice>(collection: C) => FinanceSlice[C];
}

const unreachable = () => Promise.reject(new Error("not part of this harness"));

/**
 * A fake backend behind the real persist seam, driving the real root store — so these tests see
 * the seam's own write tracking, revert and Retry rather than a mock of them.
 */
export function installFinanceBulkHarness(): FinanceBulkHarness {
  const calls: WriteCall[] = [];
  let answer: BackendAnswer = landsEverything;
  let gate: Promise<void> | null = null;
  let served: Partial<FinanceSlice> = {};

  const run = async (call: WriteCall) => {
    calls.push(call);
    if (gate) await gate;
    return answer(call);
  };

  const adapter: PersistenceAdapter = {
    init: async () => {},
    isEmpty: async () => false,
    loadAll: () => unreachable() as Promise<never>,
    readSyncVersion: () => unreachable() as Promise<never>,
    load: (collection) => {
      const rows = (served as Record<string, unknown[] | undefined>)[collection];
      return rows ? Promise.resolve(rows as never) : (unreachable() as Promise<never>);
    },
    put: async (collection) => {
      await run({ op: "put", collection, rowCount: 1 });
    },
    remove: async (collection) => {
      await run({ op: "remove", collection, rowCount: 1 });
    },
    bulkPut: async (collection, items): Promise<BulkPutResult> => {
      const written = await run({ op: "bulkPut", collection, rowCount: items.length });
      return { inserted: items.length, skipped: 0, writtenChunks: written.writtenChunks };
    },
    bulkRemove: async (collection, ids): Promise<BulkRemoveResult> => {
      const written = await run({ op: "bulkRemove", collection, rowCount: ids.length });
      return { removed: ids.length, missing: 0, writtenChunks: written.writtenChunks };
    },
    clearAll: unreachable,
  };

  persistence.setDelegate(adapter);
  setPersistAuth("uid_owner");
  useStore.setState({
    toast: null,
    authUid: "uid_owner",
    financeAccounts: [],
    financeCategories: [],
    financeBudgets: [],
    financeMerchants: [],
    financeImportBatches: [],
    financeTransactions: [],
    financeSettlements: [],
  });

  return {
    calls,
    callsFor: (op, collection) =>
      calls.filter((call) => call.op === op && call.collection === collection),
    countWrites: () => calls.length,
    answerWith: (next) => {
      answer = next;
    },
    holdCalls: () => {
      let release!: () => void;
      gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      return () => {
        gate = null;
        release();
      };
    },
    serveOnRefetch: (rows) => {
      served = rows;
    },
    seed: (rows) => useStore.setState(rows),
    read: (collection) => useStore.getState()[collection],
  };
}
