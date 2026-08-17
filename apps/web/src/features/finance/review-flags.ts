import type { FinanceImportBatch, FinanceTransaction } from "@vega/shared";
import { format, parseISO } from "date-fns";

export const REVIEW_FLAGS = [
  "no-category",
  "possible-duplicate",
  "near-duplicate",
  "auto-internal",
  "unmatched-ledger-row",
] as const;

export type FinanceReviewFlag = (typeof REVIEW_FLAGS)[number];

export const NO_CATEGORY_FLAG: FinanceReviewFlag = "no-category";

const FLAG_LABELS: Record<FinanceReviewFlag, string> = {
  "no-category": "Needs a category",
  "possible-duplicate": "Possible duplicate",
  "near-duplicate": "Near duplicate",
  "auto-internal": "Read as an internal transfer",
  "unmatched-ledger-row": "Unmatched ledger row",
};

const isReviewFlag = (flag: string): flag is FinanceReviewFlag =>
  (REVIEW_FLAGS as readonly string[]).includes(flag);

export const describeFlag = (flag: string): string =>
  isReviewFlag(flag) ? FLAG_LABELS[flag] : flag;

/**
 * `no-category` is derived from the row, never stored: the row already carries the truth, and a
 * stored copy would need clearing by every path that assigns a category — one missed path is a
 * queue that never empties, so a legacy stored copy is dropped here. An internal transfer is
 * exempt; it never earns a category, and `auto-internal` already carries the review it needs.
 */
export function unresolvedFlags(txn: FinanceTransaction): string[] {
  const storedFlags = txn.reviewFlags.filter(
    (flag) => flag !== NO_CATEGORY_FLAG && !txn.resolvedFlags.includes(flag),
  );
  return txn.categoryId === null && !txn.isInternal
    ? [NO_CATEGORY_FLAG, ...storedFlags]
    : storedFlags;
}

export const hasUnresolvedFlags = (txn: FinanceTransaction): boolean =>
  unresolvedFlags(txn).length > 0;

export const buildResolvedFlags = (txn: FinanceTransaction, flag: FinanceReviewFlag): string[] =>
  txn.resolvedFlags.includes(flag) ? txn.resolvedFlags : [...txn.resolvedFlags, flag];

/** One number behind the badge, the filter chip, the explainer and the settlement's caveat. */
export const countRowsNeedingReview = (transactions: FinanceTransaction[]): number =>
  transactions.filter(hasUnresolvedFlags).length;

/** Which day's import left the work, so the prompt names it rather than saying "some rows". */
function findLatestImportDay(
  transactions: FinanceTransaction[],
  batches: FinanceImportBatch[],
): string | null {
  const batchIds = new Set(
    transactions.filter(hasUnresolvedFlags).map((txn) => txn.importBatchId ?? ""),
  );
  const committed = batches
    .filter((batch) => batchIds.has(batch.id))
    .flatMap((batch) => (batch.committedAt === null ? [] : [batch.committedAt]))
    .sort();
  const latest = committed.at(-1);
  return latest === undefined ? null : format(parseISO(latest), "EEEE");
}

/**
 * The one review sentence. It drops the import clause rather than inventing a day when the
 * flagged rows were typed in by hand, and says nothing at all when there is nothing to review.
 */
export function describeReviewPrompt(
  transactions: FinanceTransaction[],
  batches: FinanceImportBatch[],
): string {
  const count = countRowsNeedingReview(transactions);
  if (count === 0) return "";
  const rows = count === 1 ? "1 row" : `${count} rows`;
  const day = findLatestImportDay(transactions, batches);
  const origin = day === null ? "" : ` from ${day}'s import`;
  const needs = count === 1 ? "needs" : "need";
  return `${rows}${origin} ${needs} a category or a split`;
}
