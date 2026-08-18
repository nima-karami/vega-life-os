import type {
  FinanceCategory,
  FinanceImportBatch,
  FinanceMerchant,
  FinanceSettlement,
  FinanceTransaction,
} from "@vega/shared";
import { format, parseISO } from "date-fns";
import { type ColumnSort, NONE, type SelectOption } from "@/core/ui";
import { monthOfISO } from "./month-cursor";
import { unresolvedFlags } from "./review-flags";

export type TransactionSortColumn = "date" | "description" | "category" | "amount";
export type TransactionSort = ColumnSort<TransactionSortColumn>;

export const DEFAULT_TRANSACTION_SORT: TransactionSort = { column: "date", direction: "desc" };
export const DESC_FIRST_COLUMNS: readonly TransactionSortColumn[] = ["date", "amount"];

/** "This filter constrains nothing" — a picker needs a real option for it, so it can't be `NONE`. */
export const ANY = "∅any";
/** The category filter that selects rows carrying no category at all. */
export const NO_CATEGORY = "∅nocategory";

export type ReviewFilter = "all" | "flagged" | "clear";

/** Whether a row is split with the partner at all — the ledger's `Shared` / `Mine` chips. */
export type SplitFilter = "any" | "shared" | "mine";

/** The badge deep-links into the ledger, so the review filter has to survive a URL. */
export const REVIEW_PARAM = "review";

export const readReviewFilter = (value: string | null): ReviewFilter =>
  value === "flagged" || value === "clear" ? value : "all";

export interface TransactionFilters {
  query: string;
  accountId: string;
  categoryId: string;
  month: string;
  payer: string;
  review: ReviewFilter;
  split: SplitFilter;
}

export const DEFAULT_TRANSACTION_FILTERS: TransactionFilters = {
  query: "",
  accountId: ANY,
  categoryId: ANY,
  month: ANY,
  payer: ANY,
  review: "all",
  split: "any",
};

/** Cash basis: the one period key is `txnDate`. */
export const monthOfTransaction = (txn: FinanceTransaction): string => monthOfISO(txn.txnDate);

export const formatTransactionDate = (isoDate: string): string =>
  format(parseISO(isoDate), "MMM d, yy");

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
  txn.title.toLowerCase().includes(needle) ||
  txn.note.toLowerCase().includes(needle);

/** The label a row shows: its own title, else the merchant's name, else the raw bank description. */
export function resolveTransactionTitle(
  txn: FinanceTransaction,
  merchant?: FinanceMerchant | null,
): string {
  if (txn.title !== "") return txn.title;
  if (merchant && merchant.displayName !== "") return merchant.displayName;
  return txn.description;
}

const matchesCategory = (txn: FinanceTransaction, categoryId: string): boolean => {
  if (categoryId === ANY) return true;
  if (categoryId === NO_CATEGORY) return txn.categoryId === null;
  return txn.categoryId === categoryId;
};

const matchesReview = (txn: FinanceTransaction, review: ReviewFilter): boolean => {
  if (review === "all") return true;
  const isFlagged = unresolvedFlags(txn).length > 0;
  return review === "flagged" ? isFlagged : !isFlagged;
};

const matchesSplit = (txn: FinanceTransaction, split: SplitFilter): boolean =>
  split === "any" || (split === "shared") === txn.isHousehold;

function matchesFilters(txn: FinanceTransaction, filters: TransactionFilters, needle: string) {
  if (!matchesQuery(txn, needle)) return false;
  if (filters.accountId !== ANY && txn.accountId !== filters.accountId) return false;
  if (!matchesCategory(txn, filters.categoryId)) return false;
  if (filters.month !== ANY && monthOfTransaction(txn) !== filters.month) return false;
  if (filters.payer !== ANY && txn.payer !== filters.payer) return false;
  if (!matchesSplit(txn, filters.split)) return false;
  return matchesReview(txn, filters.review);
}

/** ISO dates and generated ids are ASCII and already sort right — collation would only cost more. */
const compareCodePoints = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

function compareOnColumn(
  left: FinanceTransaction,
  right: FinanceTransaction,
  column: TransactionSortColumn,
  nameOf: (txn: FinanceTransaction) => string,
): number {
  if (column === "amount") return left.amountCents - right.amountCents;
  if (column === "description") return left.description.localeCompare(right.description);
  if (column === "category") return nameOf(left).localeCompare(nameOf(right));
  return compareCodePoints(left.txnDate, right.txnDate);
}

export function buildCategoryNames(categories: FinanceCategory[]): Map<string, string> {
  return new Map(categories.map((category) => [category.id, category.name]));
}

/**
 * The category picker's options. Assigning offers only live categories; filtering keeps archived
 * ones, because an archived category still has to be findable in the months it has rows in.
 */
export function buildCategoryOptions(
  categories: FinanceCategory[],
  scope: "filter" | "assign",
): SelectOption[] {
  if (scope === "assign")
    return [
      { value: NONE, label: "No category" },
      ...categories
        .filter((category) => category.archivedAt === null)
        .map((category) => ({ value: category.id, label: category.name })),
    ];
  return [
    { value: ANY, label: "All categories" },
    { value: NO_CATEGORY, label: "No category" },
    ...categories.map((category) => ({
      value: category.id,
      label: category.archivedAt === null ? category.name : `${category.name} (archived)`,
    })),
  ];
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
      const rankedOrder = compareOnColumn(left, right, sort.column, nameOf);
      return rankedOrder !== 0 ? rankedOrder * direction : compareCodePoints(left.id, right.id);
    });
}

/** Shift-click: everything between the anchor and the row just clicked, inclusive. */
export function selectIdRange(orderedIds: string[], anchorId: string, targetId: string): string[] {
  const anchorIndex = orderedIds.indexOf(anchorId);
  const targetIndex = orderedIds.indexOf(targetId);
  if (anchorIndex < 0 || targetIndex < 0) return [targetId];
  return orderedIds.slice(
    Math.min(anchorIndex, targetIndex),
    Math.max(anchorIndex, targetIndex) + 1,
  );
}

/** Which statement document a row came from — the owner's stated provenance requirement. */
export function describeProvenance(txn: FinanceTransaction, batches: FinanceImportBatch[]): string {
  const enteredBy = txn.enteredBy === "partner-reported" ? "partner-reported" : "entered by you";
  if (txn.source === "manual") return `Added by hand · ${enteredBy}`;
  const batch = batches.find((entry) => entry.id === txn.importBatchId);
  const file = batch?.fileNames[0] ?? "an unnamed file";
  const rowSuffix = txn.sourceRowNumber === null ? "" : `, row ${txn.sourceRowNumber}`;
  return `Imported from ${file}${rowSuffix} · ${enteredBy}`;
}
