import type {
  FinanceAccount,
  FinanceBudget,
  FinanceCategory,
  FinanceImportBatch,
  FinanceMerchant,
  FinanceSettlement,
  FinanceTransaction,
} from "@vega/shared";
import { todayISO } from "@/core/lib/date";
import { uid } from "@/core/lib/id";
import { FULL_SHARE_BPS, MIN_SPREAD_MONTHS } from "./money";
import { toMonthKey } from "./month-cursor";

/** Server-owned meta, fresh per row so two rows never share a `fieldUpdatedAt` map. */
const createRowMeta = () => ({ updatedAt: "", fieldUpdatedAt: {} });

const getCurrentMonth = () => toMonthKey(new Date());

export const buildAccount = (patch: Partial<FinanceAccount>): FinanceAccount => ({
  id: patch.id ?? uid("facc_"),
  slug: patch.slug ?? "",
  displayName: patch.displayName ?? "",
  kind: patch.kind ?? "chequing",
  isBusiness: patch.isBusiness ?? false,
  columnMapping: patch.columnMapping ?? null,
  archivedAt: patch.archivedAt ?? null,
  ...createRowMeta(),
});

export const buildCategory = (
  patch: Partial<FinanceCategory>,
  rows: FinanceCategory[],
): FinanceCategory => ({
  id: patch.id ?? uid("fcat_"),
  name: patch.name ?? "",
  kind: patch.kind ?? "spend",
  order: patch.order ?? rows.length,
  archivedAt: patch.archivedAt ?? null,
  ...createRowMeta(),
});

export const buildBudget = (patch: Partial<FinanceBudget>): FinanceBudget => {
  const categoryId = patch.categoryId ?? "";
  const month = patch.month ?? getCurrentMonth();
  return {
    id: patch.id ?? `${categoryId}:${month}`,
    categoryId,
    month,
    cents: patch.cents ?? 0,
    ...createRowMeta(),
  };
};

export const buildMerchant = (patch: Partial<FinanceMerchant>): FinanceMerchant => ({
  id: patch.id ?? uid("fmer_"),
  pattern: patch.pattern ?? "",
  displayName: patch.displayName ?? "",
  defaultCategoryId: patch.defaultCategoryId ?? null,
  defaultSpreadMonths: patch.defaultSpreadMonths ?? 1,
  timesSeen: patch.timesSeen ?? 0,
  timesShared: patch.timesShared ?? 0,
  lastSeenAt: patch.lastSeenAt ?? null,
  ...createRowMeta(),
});

export const buildImportBatch = (patch: Partial<FinanceImportBatch>): FinanceImportBatch => ({
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
  ...createRowMeta(),
});

/** An absent key falls through to the default, exactly as a per-field `??` would. */
const definedFields = <T extends object>(patch: T): Partial<T> =>
  Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  ) as Partial<T>;

/**
 * Defaults first, then the patch. Twenty-five `?? default` reads as twenty-five decisions to the
 * complexity gate when it is one; this way adding a field is adding a line.
 */
export const buildTransaction = (patch: Partial<FinanceTransaction>): FinanceTransaction => {
  const txnDate = patch.txnDate ?? todayISO();
  return {
    id: uid("ftxn_"),
    txnDate,
    spreadMonths: MIN_SPREAD_MONTHS,
    description: "",
    amountCents: 0,
    currency: "CAD",
    originalAmountCents: null,
    originalCurrency: null,
    categoryId: null,
    merchantId: null,
    payer: "me",
    isHousehold: false,
    myShareBps: FULL_SHARE_BPS,
    isInternal: false,
    reviewFlags: [],
    resolvedFlags: [],
    note: "",
    dedupeKey: null,
    accountId: null,
    source: "manual",
    enteredBy: "me",
    importBatchId: null,
    sourceRowNumber: null,
    refundOfTransactionId: null,
    createdAt: txnDate,
    ...definedFields(patch),
    ...createRowMeta(),
  };
};

export const buildSettlement = (patch: Partial<FinanceSettlement>): FinanceSettlement => {
  const month = patch.month ?? getCurrentMonth();
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
    ...createRowMeta(),
  };
};
