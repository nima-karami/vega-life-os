import type {
  FinanceCategory,
  FinanceImportBatch,
  FinanceSettlement,
  FinanceTransaction,
} from "@vega/shared";
import { format, parseISO } from "date-fns";
import type { ColumnSort } from "@/core/ui";

export type TransactionSortColumn = "date" | "description" | "category" | "amount";
export type TransactionSort = ColumnSort<TransactionSortColumn>;

export const DEFAULT_TRANSACTION_SORT: TransactionSort = { column: "date", direction: "desc" };
export const DESC_FIRST_COLUMNS: readonly TransactionSortColumn[] = ["date", "amount"];

/** "This filter constrains nothing" — a picker needs a real option for it, so it can't be `NONE`. */
export const ANY = "∅any";
/** The category filter that selects rows carrying no category at all. */
export const NO_CATEGORY = "∅nocategory";

export type ReviewFilter = "all" | "flagged" | "clear";

export interface TransactionFilters {
  query: string;
  accountId: string;
  categoryId: string;
  month: string;
  payer: string;
  review: ReviewFilter;
}

export const DEFAULT_TRANSACTION_FILTERS: TransactionFilters = {
  query: "",
  accountId: ANY,
  categoryId: ANY,
  month: ANY,
  payer: ANY,
  review: "all",
};

/** Cash basis: the one period key is `txnDate`. */
export const monthOfTransaction = (txn: FinanceTransaction): string =>
  format(parseISO(txn.txnDate), "yyyy-MM");

export const formatTransactionDate = (isoDate: string): string =>
  format(parseISO(isoDate), "MMM d, yy");

export const formatMonthLabel = (month: string): string =>
  format(parseISO(`${month}-01`), "MMMM yyyy");

/**
 * `no-category` is derived from the row at read time, never stored: the row already carries the
 * truth, and a stored copy would have to be cleared by every path that assigns a category. The
 * other flags have no other source of truth, so they stay stored and explicitly resolved.
 *
 * An internal transfer is exempt — it never earns a category, so deriving the flag there would
 * park every transfer in the queue for good. `auto-internal` already covers its real review need.
 */
export const NO_CATEGORY_FLAG = "no-category";

const needsCategory = (txn: FinanceTransaction) => txn.categoryId === null && !txn.isInternal;

export function listUnresolvedFlags(txn: FinanceTransaction): string[] {
  const stored = txn.reviewFlags.filter(
    (flag) => flag !== NO_CATEGORY_FLAG && !txn.resolvedFlags.includes(flag),
  );
  return needsCategory(txn) ? [NO_CATEGORY_FLAG, ...stored] : stored;
}

const REVIEW_FLAG_LABELS: Record<string, string> = {
  "no-category": "No category",
  "possible-duplicate": "Possible duplicate",
  "near-duplicate": "Near duplicate",
  "auto-internal": "Auto-flagged internal",
  "unmatched-ledger-row": "Unmatched ledger row",
};

export const describeFlag = (flag: string): string => REVIEW_FLAG_LABELS[flag] ?? flag;

/** A settled figure is immutable, so its rows are frozen until the month is amended. */
export const listSettledMonths = (settlements: FinanceSettlement[]): Set<string> =>
  new Set(settlements.filter((entry) => entry.status === "settled").map((entry) => entry.month));

export const isTransactionLocked = (txn: FinanceTransaction, settledMonths: Set<string>): boolean =>
  settledMonths.has(monthOfTransaction(txn));

export function listTransactionMonths(transactions: FinanceTransaction[]): string[] {
  const months = new Set(transactions.map(monthOfTransaction));
  return [...months].sort((left, right) => right.localeCompare(left));
}

const matchesQuery = (txn: FinanceTransaction, needle: string): boolean =>
  needle === "" ||
  txn.description.toLowerCase().includes(needle) ||
  txn.note.toLowerCase().includes(needle);

const matchesCategory = (txn: FinanceTransaction, categoryId: string): boolean => {
  if (categoryId === ANY) return true;
  if (categoryId === NO_CATEGORY) return txn.categoryId === null;
  return txn.categoryId === categoryId;
};

const matchesReview = (txn: FinanceTransaction, review: ReviewFilter): boolean => {
  if (review === "all") return true;
  const isFlagged = listUnresolvedFlags(txn).length > 0;
  return review === "flagged" ? isFlagged : !isFlagged;
};

function matchesFilters(txn: FinanceTransaction, filters: TransactionFilters, needle: string) {
  if (!matchesQuery(txn, needle)) return false;
  if (filters.accountId !== ANY && txn.accountId !== filters.accountId) return false;
  if (!matchesCategory(txn, filters.categoryId)) return false;
  if (filters.month !== ANY && monthOfTransaction(txn) !== filters.month) return false;
  if (filters.payer !== ANY && txn.payer !== filters.payer) return false;
  return matchesReview(txn, filters.review);
}

function compareOnColumn(
  left: FinanceTransaction,
  right: FinanceTransaction,
  column: TransactionSortColumn,
  nameOf: (txn: FinanceTransaction) => string,
): number {
  if (column === "amount") return left.amountCents - right.amountCents;
  if (column === "description") return left.description.localeCompare(right.description);
  if (column === "category") return nameOf(left).localeCompare(nameOf(right));
  return left.txnDate.localeCompare(right.txnDate);
}

export function buildCategoryNames(categories: FinanceCategory[]): Map<string, string> {
  return new Map(categories.map((category) => [category.id, category.name]));
}

/**
 * The ledger the page renders: filtered, searched over description and note, and sorted on one
 * column with a stable id tiebreak so re-sorting never shuffles equal rows.
 */
export function queryFinanceTransactions(
  transactions: FinanceTransaction[],
  categoryNames: Map<string, string>,
  filters: TransactionFilters,
  sort: TransactionSort,
): FinanceTransaction[] {
  const needle = filters.query.trim().toLowerCase();
  const nameOf = (txn: FinanceTransaction) =>
    txn.categoryId === null ? "" : (categoryNames.get(txn.categoryId) ?? "");
  const direction = sort.direction === "asc" ? 1 : -1;

  return transactions
    .filter((txn) => matchesFilters(txn, filters, needle))
    .sort((left, right) => {
      const ranked = compareOnColumn(left, right, sort.column, nameOf);
      return ranked !== 0 ? ranked * direction : left.id.localeCompare(right.id);
    });
}

/** Shift-click: everything between the anchor and the row just clicked, inclusive. */
export function selectIdRange(orderedIds: string[], anchorId: string, targetId: string): string[] {
  const from = orderedIds.indexOf(anchorId);
  const to = orderedIds.indexOf(targetId);
  if (from < 0 || to < 0) return [targetId];
  return orderedIds.slice(Math.min(from, to), Math.max(from, to) + 1);
}

const BPS_PER_PERCENT = 100;
export const MAX_SPREAD_MONTHS = 36;

/** Any percentage, not a preset list. */
export function parseShareBps(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;
  const percent = Number(trimmed);
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) return null;
  return Math.round(percent * BPS_PER_PERCENT);
}

export const formatShareBps = (bps: number): string => String(Math.round(bps) / BPS_PER_PERCENT);

export function parseSpreadMonths(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;
  const months = Number(trimmed);
  if (!Number.isInteger(months) || months < 1 || months > MAX_SPREAD_MONTHS) return null;
  return months;
}

/** Which statement document a row came from — the owner's stated provenance requirement. */
export function describeProvenance(txn: FinanceTransaction, batches: FinanceImportBatch[]): string {
  const enteredBy = txn.enteredBy === "partner-reported" ? "partner-reported" : "entered by you";
  if (txn.source === "manual") return `Added by hand · ${enteredBy}`;
  const batch = batches.find((entry) => entry.id === txn.importBatchId);
  const file = batch?.fileNames[0] ?? "an unnamed file";
  const row = txn.sourceRowNumber === null ? "" : `, row ${txn.sourceRowNumber}`;
  return `Imported from ${file}${row} · ${enteredBy}`;
}
