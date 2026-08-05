import type { FinanceTransaction } from "@vega/shared";

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
  const stored = txn.reviewFlags.filter(
    (flag) => flag !== NO_CATEGORY_FLAG && !txn.resolvedFlags.includes(flag),
  );
  return txn.categoryId === null && !txn.isInternal ? [NO_CATEGORY_FLAG, ...stored] : stored;
}

export const needsReview = (txn: FinanceTransaction): boolean => unresolvedFlags(txn).length > 0;

export const withFlagResolved = (txn: FinanceTransaction, flag: FinanceReviewFlag): string[] =>
  txn.resolvedFlags.includes(flag) ? txn.resolvedFlags : [...txn.resolvedFlags, flag];
