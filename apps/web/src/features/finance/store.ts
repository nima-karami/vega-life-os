import type {
  FinanceAccount,
  FinanceBudget,
  FinanceCategory,
  FinanceImportBatch,
  FinanceMerchant,
  FinanceSettlement,
  FinanceTransaction,
} from "@vega/shared";
import { type Dataset, PartialWriteError, persistence } from "@/core/persistence";
import { setSandboxDirty } from "@/core/persistence/sandbox-meta";
import { savePut, saveRemove } from "@/core/store/persist";
import type { Slice } from "@/core/store/slice";
import { selectCategoryReferences } from "./category-references";
import { normalizeMerchant } from "./import/merchant";
import {
  buildAccount,
  buildBudget,
  buildCategory,
  buildImportBatch,
  buildMerchant,
  buildSettlement,
  buildTransaction,
} from "./row-builders";

/** What a statement import hands the store: the rows, the merchant sightings, and its batch record. */
interface FinanceImportInput {
  transactions: Partial<FinanceTransaction>[];
  merchants: Partial<FinanceMerchant>[];
  batch: Partial<FinanceImportBatch>;
}

export interface FinanceImportOutcome {
  writtenRows: number;
  writtenChunks: number;
  /** the chunk that rejected, or null when the whole import landed */
  failedChunk: number | null;
}

/** One slice for all seven finance collections — seven parallel CRUD stacks would breach the jscpd gate. */
export interface FinanceSlice {
  financeAccounts: FinanceAccount[];
  financeCategories: FinanceCategory[];
  financeBudgets: FinanceBudget[];
  financeMerchants: FinanceMerchant[];
  financeImportBatches: FinanceImportBatch[];
  financeTransactions: FinanceTransaction[];
  financeSettlements: FinanceSettlement[];

  addFinanceAccount: (patch?: Partial<FinanceAccount>) => FinanceAccount;
  updateFinanceAccount: (id: string, patch: Partial<FinanceAccount>) => void;
  removeFinanceAccount: (id: string) => void;

  addFinanceCategory: (patch?: Partial<FinanceCategory>) => FinanceCategory;
  updateFinanceCategory: (id: string, patch: Partial<FinanceCategory>) => void;
  removeFinanceCategory: (id: string) => void;

  addFinanceBudget: (patch?: Partial<FinanceBudget>) => FinanceBudget;
  updateFinanceBudget: (id: string, patch: Partial<FinanceBudget>) => void;
  removeFinanceBudget: (id: string) => void;

  addFinanceMerchant: (patch?: Partial<FinanceMerchant>) => FinanceMerchant;
  updateFinanceMerchant: (id: string, patch: Partial<FinanceMerchant>) => void;
  removeFinanceMerchant: (id: string) => void;

  addFinanceImportBatch: (patch?: Partial<FinanceImportBatch>) => FinanceImportBatch;
  updateFinanceImportBatch: (id: string, patch: Partial<FinanceImportBatch>) => void;
  removeFinanceImportBatch: (id: string) => void;

  addFinanceTransaction: (patch?: Partial<FinanceTransaction>) => FinanceTransaction;
  updateFinanceTransaction: (id: string, patch: Partial<FinanceTransaction>) => void;
  removeFinanceTransaction: (id: string) => void;

  addFinanceSettlement: (patch?: Partial<FinanceSettlement>) => FinanceSettlement;
  updateFinanceSettlement: (id: string, patch: Partial<FinanceSettlement>) => void;
  removeFinanceSettlement: (id: string) => void;

  /** Set a row's filing. A category teaches the merchant; a share never does. */
  fileTransaction: (id: string, patch: Partial<FinanceTransaction>) => void;
  /** The same rule over a whole selection, in one batched write. */
  fileTransactions: (ids: readonly string[], patch: Partial<FinanceTransaction>) => Promise<void>;
  mergeFinanceCategories: (sourceId: string, targetId: string) => Promise<void>;
  rollBackFinanceImport: (batchId: string) => void;
  importFinanceTransactions: (input: FinanceImportInput) => Promise<FinanceImportOutcome>;
}

type FinanceCollection =
  | "financeAccounts"
  | "financeCategories"
  | "financeBudgets"
  | "financeMerchants"
  | "financeImportBatches"
  | "financeTransactions"
  | "financeSettlements";

type FinanceRow<C extends FinanceCollection> = Dataset[C][number];

type FinanceStateWriter = Parameters<Slice<FinanceSlice>>[0];
type FinanceStateReader = Parameters<Slice<FinanceSlice>>[1];

interface FinanceCrud<C extends FinanceCollection> {
  add: (patch?: Partial<FinanceRow<C>>) => FinanceRow<C>;
  update: (id: string, patch: Partial<FinanceRow<C>>) => void;
  remove: (id: string) => void;
}

const RETRY_MESSAGE = "Couldn’t save your change — check your connection";

/**
 * The one optimistic-write path every finance collection shares. `add` is an upsert on the
 * built id: budgets and settlements derive theirs from a natural key, and a generated id
 * never collides, so appending is unchanged.
 */
function createFinanceCrud<C extends FinanceCollection>(
  collection: C,
  buildRow: (patch: Partial<FinanceRow<C>>, rows: FinanceRow<C>[]) => FinanceRow<C>,
  set: FinanceStateWriter,
  get: FinanceStateReader,
): FinanceCrud<C> {
  const readRows = () => get()[collection] as FinanceRow<C>[];
  const commit = (rows: FinanceRow<C>[]) => set({ [collection]: rows } as Partial<FinanceSlice>);

  return {
    add: (patch = {}) => {
      const rows = readRows();
      const row = buildRow(patch, rows);
      const prior = rows.find((existing) => existing.id === row.id);
      commit([...rows.filter((existing) => existing.id !== row.id), row]);
      savePut(collection, row, prior ? { kind: "update", prior } : { kind: "insert" });
      return row;
    },
    update: (id, patch) => {
      const prior = readRows().find((row) => row.id === id);
      if (!prior) return;
      const next = { ...prior, ...patch, id } as FinanceRow<C>;
      commit(readRows().map((row) => (row.id === id ? next : row)));
      savePut(collection, next, { kind: "update", prior });
    },
    remove: (id) => {
      const prior = readRows().find((row) => row.id === id);
      if (!prior) return;
      commit(readRows().filter((row) => row.id !== id));
      saveRemove(collection, id, prior);
    },
  };
}

function mergeById<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const incomingById = new Map(incoming.map((row) => [row.id, row]));
  const existingIds = new Set(existing.map((row) => row.id));
  return [
    ...existing.map((row) => incomingById.get(row.id) ?? row),
    ...incoming.filter((row) => !existingIds.has(row.id)),
  ];
}

/** What a chunked bulk call left behind: a landed prefix on a partial commit, nothing otherwise. */
function readBulkLanding(error: unknown): FinanceImportOutcome {
  const partial = error instanceof PartialWriteError ? error.detail : null;
  return {
    writtenRows: partial?.writtenRows ?? 0,
    writtenChunks: partial?.writtenChunks ?? 0,
    failedChunk: partial?.failedChunk ?? 0,
  };
}

interface ImportLanding extends FinanceImportOutcome {
  didWriteMerchants: boolean;
}

/** The two bulk calls a statement makes, reconciled into what actually landed. */
async function landImportedRows(
  merchants: FinanceMerchant[],
  transactions: FinanceTransaction[],
): Promise<ImportLanding> {
  let didWriteMerchants = false;
  try {
    if (merchants.length > 0) await persistence.bulkPut("financeMerchants", merchants);
    didWriteMerchants = true;
    const written = await persistence.bulkPut("financeTransactions", transactions);
    return {
      didWriteMerchants,
      writtenRows: transactions.length,
      writtenChunks: written.writtenChunks,
      failedChunk: null,
    };
  } catch (error) {
    return { didWriteMerchants, ...readBulkLanding(error) };
  }
}

export const createFinanceSlice: Slice<FinanceSlice> = (set, get) => {
  const accounts = createFinanceCrud("financeAccounts", buildAccount, set, get);
  const categories = createFinanceCrud("financeCategories", buildCategory, set, get);
  const budgets = createFinanceCrud("financeBudgets", buildBudget, set, get);
  const merchants = createFinanceCrud("financeMerchants", buildMerchant, set, get);
  const batches = createFinanceCrud("financeImportBatches", buildImportBatch, set, get);
  const transactions = createFinanceCrud("financeTransactions", buildTransaction, set, get);
  const settlements = createFinanceCrud("financeSettlements", buildSettlement, set, get);

  const markSandboxDirty = () => {
    if (get().authUid === null) void setSandboxDirty(true);
  };

  /**
   * The one bulk write path: the whole payload goes through the adapter's `bulkPut` in a single
   * call — the backend chunks it and bumps the sync counter once, where a per-row loop bumps it
   * once per row. A rejection puts the prior rows back and offers the same Retry a single write
   * does; a partial commit keeps exactly the prefix the backend says landed. `prior` runs parallel
   * to `next`, with a gap where the row is new — those can only be settled by the refetch.
   */
  const commitRows = async <C extends FinanceCollection>(
    collection: C,
    next: FinanceRow<C>[],
    prior: (FinanceRow<C> | undefined)[],
  ): Promise<void> => {
    if (next.length === 0) return;
    markSandboxDirty();
    const apply = (rows: FinanceRow<C>[]) =>
      set({
        [collection]: mergeById(get()[collection] as FinanceRow<C>[], rows),
      } as Partial<FinanceSlice>);

    apply(next);
    try {
      await persistence.bulkPut(collection, next as Dataset[C]);
    } catch (error) {
      const landed = readBulkLanding(error).writtenRows;
      apply(prior.slice(landed).filter((row) => row !== undefined));
      void get().refetchCollection(collection);
      get().pushRetryToast(RETRY_MESSAGE, () => void commitRows(collection, next, prior));
    }
  };

  const selectTransactions = (ids: readonly string[]): FinanceTransaction[] => {
    const byId = new Map(get().financeTransactions.map((row) => [row.id, row]));
    return ids.flatMap((id) => {
      const row = byId.get(id);
      return row ? [row] : [];
    });
  };

  /**
   * Category corrections teach the merchant — that is what makes week 12 cheaper than week 1, and
   * an unknown merchant is born at this moment. A share deliberately never writes back: the same
   * merchant legitimately splits differently within one month.
   */
  const teachMerchants = (rows: FinanceTransaction[], categoryId: string) => {
    const known = new Map(get().financeMerchants.map((merchant) => [merchant.pattern, merchant]));
    const taught = new Map<string, FinanceMerchant>();
    const merchantIdByRow = new Map<string, string>();

    for (const row of rows) {
      const pattern = normalizeMerchant(row.description);
      const prior = taught.get(pattern) ?? known.get(pattern);
      const merchant = prior
        ? { ...prior, defaultCategoryId: categoryId }
        : buildMerchant({
            pattern,
            displayName: pattern,
            timesSeen: 1,
            lastSeenAt: row.txnDate,
            defaultCategoryId: categoryId,
          });
      taught.set(pattern, merchant);
      merchantIdByRow.set(row.id, merchant.id);
    }

    const priorRows = [...taught.keys()].map((pattern) => known.get(pattern));
    return { merchants: [...taught.values()], priorRows, merchantIdByRow };
  };

  const fileTransaction = (id: string, patch: Partial<FinanceTransaction>) => {
    const row = get().financeTransactions.find((txn) => txn.id === id);
    if (!row) return;
    if (typeof patch.categoryId !== "string") {
      transactions.update(id, patch);
      return;
    }
    const taught = teachMerchants([row], patch.categoryId);
    for (const merchant of taught.merchants) merchants.add(merchant);
    transactions.update(id, {
      ...patch,
      merchantId: taught.merchantIdByRow.get(id) ?? row.merchantId,
    });
  };

  const fileTransactions = async (ids: readonly string[], patch: Partial<FinanceTransaction>) => {
    const prior = selectTransactions(ids);
    if (prior.length === 0) return;
    if (typeof patch.categoryId !== "string") {
      await commitRows(
        "financeTransactions",
        prior.map((row) => ({ ...row, ...patch, id: row.id })),
        prior,
      );
      return;
    }
    const taught = teachMerchants(prior, patch.categoryId);
    await commitRows("financeMerchants", taught.merchants, taught.priorRows);
    await commitRows(
      "financeTransactions",
      prior.map((row) => ({
        ...row,
        ...patch,
        id: row.id,
        merchantId: taught.merchantIdByRow.get(row.id) ?? row.merchantId,
      })),
      prior,
    );
  };

  /**
   * Collapsing imported categories is the day-one workflow, so it moves everything that points at
   * the source in two batched writes. Budgets are the one thing merge does not carry over — two
   * budgets are never summed, so the source's rows are removed rather than retargeted.
   */
  const mergeFinanceCategories = async (sourceId: string, targetId: string) => {
    const refs = selectCategoryReferences(get(), sourceId);
    await commitRows(
      "financeTransactions",
      refs.transactions.map((txn) => ({ ...txn, categoryId: targetId })),
      refs.transactions,
    );
    await commitRows(
      "financeMerchants",
      refs.merchants.map((merchant) => ({ ...merchant, defaultCategoryId: targetId })),
      refs.merchants,
    );
    for (const budget of refs.budgets) budgets.remove(budget.id);
    categories.update(sourceId, { archivedAt: new Date().toISOString() });
  };

  /** Row-at-a-time: there is no bulk delete seam, and a rolled-back batch is one statement's rows. */
  const rollBackFinanceImport = (batchId: string) => {
    for (const txn of get().financeTransactions) {
      if (txn.importBatchId === batchId) transactions.remove(txn.id);
    }
    batches.remove(batchId);
  };

  /**
   * State is set from what the backend says landed, never optimistically, so a partial commit
   * can't leave phantom rows on screen.
   */
  const importFinanceTransactions = async (
    input: FinanceImportInput,
  ): Promise<FinanceImportOutcome> => {
    const sightings = input.merchants.map((patch) => buildMerchant(patch));
    const rows = input.transactions.map((patch) => buildTransaction(patch));
    markSandboxDirty();

    const landing = await landImportedRows(sightings, rows);
    const landed = rows.slice(0, landing.writtenRows);
    const next: Partial<FinanceSlice> = {
      financeTransactions: mergeById(get().financeTransactions, landed),
    };
    if (landing.didWriteMerchants)
      next.financeMerchants = mergeById(get().financeMerchants, sightings);
    set(next);

    batches.add({
      ...input.batch,
      status: landing.failedChunk === null ? "committed" : "partial-commit",
      rowsInserted: landed.length,
      writtenChunks: landing.writtenChunks,
      committedAt: landing.failedChunk === null ? new Date().toISOString() : null,
    });

    return {
      writtenRows: landed.length,
      writtenChunks: landing.writtenChunks,
      failedChunk: landing.failedChunk,
    };
  };

  return {
    financeAccounts: [],
    financeCategories: [],
    financeBudgets: [],
    financeMerchants: [],
    financeImportBatches: [],
    financeTransactions: [],
    financeSettlements: [],

    addFinanceAccount: accounts.add,
    updateFinanceAccount: accounts.update,
    removeFinanceAccount: accounts.remove,

    addFinanceCategory: categories.add,
    updateFinanceCategory: categories.update,
    removeFinanceCategory: categories.remove,

    addFinanceBudget: budgets.add,
    updateFinanceBudget: budgets.update,
    removeFinanceBudget: budgets.remove,

    addFinanceMerchant: merchants.add,
    updateFinanceMerchant: merchants.update,
    removeFinanceMerchant: merchants.remove,

    addFinanceImportBatch: batches.add,
    updateFinanceImportBatch: batches.update,
    removeFinanceImportBatch: batches.remove,

    addFinanceTransaction: transactions.add,
    updateFinanceTransaction: transactions.update,
    removeFinanceTransaction: transactions.remove,

    addFinanceSettlement: settlements.add,
    updateFinanceSettlement: settlements.update,
    removeFinanceSettlement: settlements.remove,

    fileTransaction,
    fileTransactions,
    mergeFinanceCategories,
    rollBackFinanceImport,
    importFinanceTransactions,
  };
};
