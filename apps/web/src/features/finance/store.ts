import type {
  FinanceAccount,
  FinanceBudget,
  FinanceCategory,
  FinanceImportBatch,
  FinanceMerchant,
  FinanceSettlement,
  FinanceTransaction,
} from "@vega/shared";
import { format } from "date-fns";
import { todayISO } from "@/core/lib/date";
import { uid } from "@/core/lib/id";
import { type Dataset, persistence } from "@/core/persistence";
import { savePut, saveRemove } from "@/core/store/persist";
import type { Slice } from "@/core/store/slice";

/** What a statement import hands the store: the rows, the merchant sightings, and its batch record. */
export interface FinanceImportInput {
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

type FinanceSet = Parameters<Slice<FinanceSlice>>[0];
type FinanceGet = Parameters<Slice<FinanceSlice>>[1];

interface FinanceCrud<C extends FinanceCollection> {
  add: (patch?: Partial<FinanceRow<C>>) => FinanceRow<C>;
  update: (id: string, patch: Partial<FinanceRow<C>>) => void;
  remove: (id: string) => void;
}

/** Server-owned meta, fresh per row so two rows never share a `fieldUpdatedAt` map. */
const newMeta = () => ({ updatedAt: "", fieldUpdatedAt: {} });

const currentMonth = () => format(new Date(), "yyyy-MM");

/**
 * The one optimistic-write path every finance collection shares. `add` is an upsert on the
 * built id: budgets and settlements derive theirs from a natural key, and a generated id
 * never collides, so appending is unchanged.
 */
function createFinanceCrud<C extends FinanceCollection>(
  collection: C,
  buildRow: (patch: Partial<FinanceRow<C>>, rows: FinanceRow<C>[]) => FinanceRow<C>,
  set: FinanceSet,
  get: FinanceGet,
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

const buildAccount = (patch: Partial<FinanceAccount>): FinanceAccount => ({
  id: patch.id ?? uid("facc_"),
  slug: patch.slug ?? "",
  displayName: patch.displayName ?? "",
  kind: patch.kind ?? "chequing",
  isBusiness: patch.isBusiness ?? false,
  columnMapping: patch.columnMapping ?? null,
  archivedAt: patch.archivedAt ?? null,
  ...newMeta(),
});

const buildCategory = (
  patch: Partial<FinanceCategory>,
  rows: FinanceCategory[],
): FinanceCategory => ({
  id: patch.id ?? uid("fcat_"),
  name: patch.name ?? "",
  kind: patch.kind ?? "spend",
  order: patch.order ?? rows.length,
  archivedAt: patch.archivedAt ?? null,
  ...newMeta(),
});

const buildBudget = (patch: Partial<FinanceBudget>): FinanceBudget => {
  const categoryId = patch.categoryId ?? "";
  const month = patch.month ?? currentMonth();
  return {
    id: patch.id ?? `${categoryId}:${month}`,
    categoryId,
    month,
    cents: patch.cents ?? 0,
    ...newMeta(),
  };
};

const buildMerchant = (patch: Partial<FinanceMerchant>): FinanceMerchant => ({
  id: patch.id ?? uid("fmer_"),
  pattern: patch.pattern ?? "",
  displayName: patch.displayName ?? "",
  defaultCategoryId: patch.defaultCategoryId ?? null,
  defaultSpreadMonths: patch.defaultSpreadMonths ?? 1,
  timesSeen: patch.timesSeen ?? 0,
  timesShared: patch.timesShared ?? 0,
  lastSeenAt: patch.lastSeenAt ?? null,
  ...newMeta(),
});

const buildImportBatch = (patch: Partial<FinanceImportBatch>): FinanceImportBatch => ({
  id: patch.id ?? uid("fbat_"),
  status: patch.status ?? "parsing",
  fileNames: patch.fileNames ?? [],
  fileHashes: patch.fileHashes ?? [],
  accountId: patch.accountId ?? "",
  detectedFormat: patch.detectedFormat ?? null,
  rowsParsed: patch.rowsParsed ?? 0,
  rowsInserted: patch.rowsInserted ?? 0,
  rowsSkipped: patch.rowsSkipped ?? 0,
  startedAt: patch.startedAt ?? new Date().toISOString(),
  committedAt: patch.committedAt ?? null,
  writtenChunks: patch.writtenChunks ?? 0,
  ...newMeta(),
});

type TransactionAmounts = Pick<
  FinanceTransaction,
  | "txnDate"
  | "spreadMonths"
  | "description"
  | "amountCents"
  | "currency"
  | "originalAmountCents"
  | "originalCurrency"
>;

type TransactionFiling = Pick<
  FinanceTransaction,
  | "categoryId"
  | "merchantId"
  | "payer"
  | "isHousehold"
  | "myShareBps"
  | "isInternal"
  | "reviewFlags"
  | "resolvedFlags"
  | "note"
>;

type TransactionOrigin = Pick<
  FinanceTransaction,
  | "dedupeKey"
  | "accountId"
  | "source"
  | "enteredBy"
  | "importBatchId"
  | "sourceRowNumber"
  | "refundOfTransactionId"
  | "createdAt"
>;

const buildTransactionAmounts = (
  patch: Partial<FinanceTransaction>,
  txnDate: string,
): TransactionAmounts => ({
  txnDate,
  spreadMonths: patch.spreadMonths ?? 1,
  description: patch.description ?? "",
  amountCents: patch.amountCents ?? 0,
  currency: patch.currency ?? "CAD",
  originalAmountCents: patch.originalAmountCents ?? null,
  originalCurrency: patch.originalCurrency ?? null,
});

const buildTransactionFiling = (patch: Partial<FinanceTransaction>): TransactionFiling => ({
  categoryId: patch.categoryId ?? null,
  merchantId: patch.merchantId ?? null,
  payer: patch.payer ?? "me",
  isHousehold: patch.isHousehold ?? false,
  myShareBps: patch.myShareBps ?? 10000,
  isInternal: patch.isInternal ?? false,
  reviewFlags: patch.reviewFlags ?? [],
  resolvedFlags: patch.resolvedFlags ?? [],
  note: patch.note ?? "",
});

const buildTransactionOrigin = (
  patch: Partial<FinanceTransaction>,
  txnDate: string,
): TransactionOrigin => ({
  dedupeKey: patch.dedupeKey ?? null,
  accountId: patch.accountId ?? null,
  source: patch.source ?? "manual",
  enteredBy: patch.enteredBy ?? "me",
  importBatchId: patch.importBatchId ?? null,
  sourceRowNumber: patch.sourceRowNumber ?? null,
  refundOfTransactionId: patch.refundOfTransactionId ?? null,
  createdAt: patch.createdAt ?? txnDate,
});

const buildTransaction = (patch: Partial<FinanceTransaction>): FinanceTransaction => {
  const txnDate = patch.txnDate ?? todayISO();
  return {
    id: patch.id ?? uid("ftxn_"),
    ...buildTransactionAmounts(patch, txnDate),
    ...buildTransactionFiling(patch),
    ...buildTransactionOrigin(patch, txnDate),
    ...newMeta(),
  };
};

const buildSettlement = (patch: Partial<FinanceSettlement>): FinanceSettlement => {
  const month = patch.month ?? currentMonth();
  return {
    id: patch.id ?? month,
    month,
    status: patch.status ?? "open",
    settledBalanceCents: patch.settledBalanceCents ?? null,
    settledAt: patch.settledAt ?? null,
    paidCents: patch.paidCents ?? null,
    paidAt: patch.paidAt ?? null,
    paymentTransactionId: patch.paymentTransactionId ?? null,
    carriedDeltaCents: patch.carriedDeltaCents ?? 0,
    note: patch.note ?? "",
    ...newMeta(),
  };
};

/** Firestore caps a batch at 500 writes; the server chunks at 450, so a rejected chunk is reportable. */
const IMPORT_CHUNK_ROWS = 450;

function chunkRows<T>(rows: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let start = 0; start < rows.length; start += size) {
    chunks.push(rows.slice(start, start + size));
  }
  return chunks;
}

function mergeById<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const incomingById = new Map(incoming.map((row) => [row.id, row]));
  const existingIds = new Set(existing.map((row) => row.id));
  return [
    ...existing.map((row) => incomingById.get(row.id) ?? row),
    ...incoming.filter((row) => !existingIds.has(row.id)),
  ];
}

export const createFinanceSlice: Slice<FinanceSlice> = (set, get) => {
  const accounts = createFinanceCrud("financeAccounts", buildAccount, set, get);
  const categories = createFinanceCrud("financeCategories", buildCategory, set, get);
  const budgets = createFinanceCrud("financeBudgets", buildBudget, set, get);
  const merchants = createFinanceCrud("financeMerchants", buildMerchant, set, get);
  const batches = createFinanceCrud("financeImportBatches", buildImportBatch, set, get);
  const transactions = createFinanceCrud("financeTransactions", buildTransaction, set, get);
  const settlements = createFinanceCrud("financeSettlements", buildSettlement, set, get);

  /**
   * The one bulk write path: rows go through the adapter's `bulkPut`, which routes to the
   * batched `data.importCollection`, so a statement costs a handful of sync-counter bumps
   * instead of one per row. State is set from what actually landed — never optimistically —
   * so a partial commit can't leave phantom rows on screen.
   */
  const importFinanceTransactions = async (
    input: FinanceImportInput,
  ): Promise<FinanceImportOutcome> => {
    const merchants = input.merchants.map((patch) => buildMerchant(patch));
    const transactions = input.transactions.map((patch) => buildTransaction(patch));

    let didWriteMerchants = false;
    let writtenChunks = 0;
    let failedChunk: number | null = null;
    try {
      if (merchants.length > 0) await persistence.bulkPut("financeMerchants", merchants);
      didWriteMerchants = true;
      for (const chunk of chunkRows(transactions, IMPORT_CHUNK_ROWS)) {
        await persistence.bulkPut("financeTransactions", chunk);
        writtenChunks += 1;
      }
    } catch {
      failedChunk = writtenChunks;
    }

    const landed = transactions.slice(0, writtenChunks * IMPORT_CHUNK_ROWS);
    const next: Partial<FinanceSlice> = {
      financeTransactions: mergeById(get().financeTransactions, landed),
    };
    if (didWriteMerchants) next.financeMerchants = mergeById(get().financeMerchants, merchants);
    set(next);

    batches.add({
      ...input.batch,
      status: failedChunk === null ? "committed" : "partial-commit",
      rowsInserted: landed.length,
      writtenChunks,
      committedAt: failedChunk === null ? new Date().toISOString() : null,
    });

    return { writtenRows: landed.length, writtenChunks, failedChunk };
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

    importFinanceTransactions,
  };
};
