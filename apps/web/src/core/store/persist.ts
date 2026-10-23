import {
  type BulkPutResult,
  type BulkRemoveResult,
  type CollectionName,
  type Dataset,
  PartialWriteError,
  persistence,
} from "@/core/persistence";
import { setSandboxDirty } from "@/core/persistence/sandbox-meta";
import type { RootState } from "./types";

/**
 * The store is injected (not imported) to avoid a store→slice→persist import
 * cycle. store.ts calls `bindPersistStore(useStore)` once, after the store exists.
 */
type StoreRef = {
  getState: () => RootState;
  setState: (partial: (state: RootState) => Partial<RootState>) => void;
};
let store: StoreRef | null = null;
export function bindPersistStore(ref: StoreRef) {
  store = ref;
}

/** Current auth uid, mirrored here so signed-out writes can flag the sandbox dirty. */
let _authUid: string | null = null;
export function setPersistAuth(uid: string | null) {
  _authUid = uid;
}

/** Mark the local sandbox dirty on any signed-out user write. Seeding and import go straight to the adapter. */
function markDirtyIfSandbox() {
  if (_authUid === null) void setSandboxDirty(true);
}

type Row = { id: string };

/**
 * Per-collection count of writes that have been applied optimistically but not yet
 * settled server-side. A focus/interval refetch consults this so it never overwrites
 * a collection whose in-flight write it can't yet see (the change would vanish).
 */
const inFlightWrites = new Map<CollectionName, number>();

export function pendingWriteCollections(): Set<CollectionName> {
  return new Set(inFlightWrites.keys());
}

function trackWrite<T>(col: CollectionName, op: Promise<T>): Promise<T> {
  inFlightWrites.set(col, (inFlightWrites.get(col) ?? 0) + 1);
  return op.finally(() => {
    const remaining = (inFlightWrites.get(col) ?? 1) - 1;
    if (remaining <= 0) inFlightWrites.delete(col);
    else inFlightWrites.set(col, remaining);
  });
}

/**
 * How to undo a rejected optimistic write: `insert` drops the row it added,
 * `update` restores the prior row it replaced. Call sites that don't opt in
 * (pass nothing) keep their optimistic value and reconcile on the background
 * refetch — never a destructive local drop. Signed-out Dexie writes don't reach
 * this path (they don't reject).
 */
export type WriteRollback<C extends CollectionName> =
  | { kind: "insert" }
  | { kind: "update"; prior: Dataset[C][number] };

function applyRollback<C extends CollectionName>(col: C, id: string, rollback?: WriteRollback<C>) {
  if (!rollback) return;
  store?.setState((state) => {
    const list = ((state as unknown as Record<string, Row[]>)[col] ?? []) as Row[];
    const next =
      rollback.kind === "insert"
        ? list.filter((row) => row.id !== id)
        : list.map((row) => (row.id === id ? (rollback.prior as Row) : row));
    return { [col]: next } as unknown as Partial<RootState>;
  });
}

function undoRemove<C extends CollectionName>(col: C, prior: Dataset[C][number] | undefined) {
  if (!prior) return;
  store?.setState((state) => {
    const list = ((state as unknown as Record<string, Row[]>)[col] ?? []) as Row[];
    return { [col]: [...list, prior as Row] } as unknown as Partial<RootState>;
  });
}

function raiseRetry(retry: () => void) {
  store?.getState().pushRetryToast("Couldn’t save your change. Check your connection", retry);
}

/**
 * Persist an insert/update. On rejection: undo the optimistic change per
 * `rollback`, background-refetch to reconcile, and offer a Retry.
 */
export function savePut<C extends CollectionName>(
  col: C,
  item: Dataset[C][number],
  rollback?: WriteRollback<C>,
) {
  markDirtyIfSandbox();
  const id = (item as Row).id;
  void trackWrite(col, persistence.put(col, item)).catch(() => {
    applyRollback(col, id, rollback);
    void store?.getState().refetchCollection(col);
    raiseRetry(() => savePut(col, item, rollback));
  });
}

/** Persist a delete. On rejection: re-add the removed row (if given), refetch, and offer a Retry. */
export function saveRemove<C extends CollectionName>(
  col: C,
  id: string,
  prior?: Dataset[C][number],
) {
  markDirtyIfSandbox();
  void trackWrite(col, persistence.remove(col, id)).catch(() => {
    undoRemove(col, prior);
    void store?.getState().refetchCollection(col);
    raiseRetry(() => saveRemove(col, id, prior));
  });
}

/**
 * What a bulk save left behind. A rejection is already reverted, refetched and toasted here, so a
 * caller reports the landing instead of catching — `result` is null exactly when the call failed.
 */
export interface BulkSaveOutcome<R> {
  /** rows the backend confirmed; on a partial commit, the prefix that landed */
  landedRows: number;
  writtenChunks: number;
  /** the chunk the backend rejected, `null` when the whole call landed */
  failedChunk: number | null;
  result: R | null;
}

/** What a bulk write puts in the store, by row id: a row value upserts it, `null` drops it. */
type RowStates<C extends CollectionName> = Map<string, Dataset[C][number] | null>;

/** What a rejected chunked write says it left behind; a whole-call loss lost its first chunk. */
function readBulkLanding(error: unknown): Omit<BulkSaveOutcome<never>, "result"> {
  const detail = error instanceof PartialWriteError ? error.detail : null;
  return {
    landedRows: detail?.writtenRows ?? 0,
    writtenChunks: detail?.writtenChunks ?? 0,
    failedChunk: detail?.failedChunk ?? 0,
  };
}

/** One store update for the whole batch — a per-row write would re-render once per row. */
function applyRowStates<C extends CollectionName>(col: C, rows: RowStates<C>) {
  if (rows.size === 0) return;
  store?.setState((state) => {
    const list = ((state as unknown as Record<string, Row[]>)[col] ?? []) as Row[];
    const kept = list.flatMap((row) => {
      if (!rows.has(row.id)) return [row];
      const next = rows.get(row.id);
      return next ? [next as Row] : [];
    });
    const present = new Set(kept.map((row) => row.id));
    const added = [...rows].flatMap(([id, next]) =>
      next && !present.has(id) ? [next as Row] : [],
    );
    return { [col]: [...kept, ...added] } as unknown as Partial<RootState>;
  });
}

function toPutUndo<C extends CollectionName>(
  items: Dataset[C],
  rollbacks: WriteRollback<C>[] | undefined,
  landedRows: number,
): RowStates<C> {
  const undo: RowStates<C> = new Map();
  if (!rollbacks) return undo;
  for (let index = landedRows; index < items.length; index += 1) {
    const rollback = rollbacks[index];
    if (rollback)
      undo.set((items[index] as Row).id, rollback.kind === "insert" ? null : rollback.prior);
  }
  return undo;
}

function toRemoveUndo<C extends CollectionName>(
  ids: string[],
  priorRows: (Dataset[C][number] | undefined)[] | undefined,
  landedRows: number,
): RowStates<C> {
  const undo: RowStates<C> = new Map();
  for (let index = landedRows; index < ids.length; index += 1) {
    const prior = priorRows?.[index];
    if (prior) undo.set(ids[index], prior);
  }
  return undo;
}

/**
 * The shared body of both bulk saves: track the write so a focus refetch can't overwrite it
 * mid-flight, and on a rejection undo only the rows past the landed prefix before reconciling.
 * `retry` must re-apply the optimistic rows before re-issuing the write, or a write that succeeds
 * on the second attempt leaves the reverted rows on screen. Re-applying keys by id, so a prefix
 * that already landed isn't applied twice.
 */
async function saveBulk<C extends CollectionName, R extends { writtenChunks: number }>(
  col: C,
  rowCount: number,
  write: () => Promise<R>,
  buildUndo: (landedRows: number) => RowStates<C>,
  retry: () => void,
): Promise<BulkSaveOutcome<R>> {
  markDirtyIfSandbox();
  try {
    const result = await trackWrite(col, write());
    return {
      landedRows: rowCount,
      writtenChunks: result.writtenChunks,
      failedChunk: null,
      result,
    };
  } catch (error) {
    const landing = readBulkLanding(error);
    applyRowStates(col, buildUndo(landing.landedRows));
    void store?.getState().refetchCollection(col);
    raiseRetry(retry);
    return { ...landing, result: null };
  }
}

/**
 * Persist a batch of inserts/updates the caller has already applied optimistically. `rollbacks`
 * runs parallel to `items` — omit it to keep the optimistic rows and let the refetch settle them.
 * Signed in, one row the server's schema rejects fails the whole call before any chunk is written.
 */
export function saveBulkPut<C extends CollectionName>(
  col: C,
  items: Dataset[C],
  rollbacks?: WriteRollback<C>[],
): Promise<BulkSaveOutcome<BulkPutResult>> {
  return saveBulk(
    col,
    items.length,
    () => persistence.bulkPut(col, items),
    (landedRows) => toPutUndo(items, rollbacks, landedRows),
    () => {
      applyRowStates(col, new Map(items.map((item) => [(item as Row).id, item])));
      void saveBulkPut(col, items, rollbacks);
    },
  );
}

/**
 * Persist a batch of deletes the caller has already applied optimistically. `priorRows` runs
 * parallel to `ids` and is what a rejection puts back.
 */
export function saveBulkRemove<C extends CollectionName>(
  col: C,
  ids: string[],
  priorRows?: (Dataset[C][number] | undefined)[],
): Promise<BulkSaveOutcome<BulkRemoveResult>> {
  return saveBulk(
    col,
    ids.length,
    () => persistence.bulkRemove(col, ids),
    (landedRows) => toRemoveUndo<C>(ids, priorRows, landedRows),
    () => {
      applyRowStates<C>(col, new Map(ids.map((id) => [id, null])));
      void saveBulkRemove(col, ids, priorRows);
    },
  );
}
