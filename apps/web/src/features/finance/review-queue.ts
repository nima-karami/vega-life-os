import type { FinanceTransaction } from "@vega/shared";

export const REVIEW_FLAGS = [
  "no-category",
  "possible-duplicate",
  "near-duplicate",
  "auto-internal",
] as const;

export type FinanceReviewFlag = (typeof REVIEW_FLAGS)[number];

const FLAG_LABELS: Record<FinanceReviewFlag, string> = {
  "no-category": "Needs a category",
  "possible-duplicate": "Possible duplicate",
  "near-duplicate": "Near duplicate",
  "auto-internal": "Read as an internal transfer",
};

/**
 * `no-category` is derived from the row, never stored: a stored copy would need clearing by
 * every path that assigns a category, and one missed path is a queue that never empties. An
 * internal transfer is exempt — it legitimately never gets a category, and its own
 * `auto-internal` flag already carries the review it does need.
 */
export function unresolvedFlags(txn: FinanceTransaction): string[] {
  const stored = txn.reviewFlags.filter((flag) => !txn.resolvedFlags.includes(flag));
  return txn.categoryId === null && !txn.isInternal ? ["no-category", ...stored] : stored;
}

export const needsReview = (txn: FinanceTransaction): boolean => unresolvedFlags(txn).length > 0;

export interface ReviewGroup {
  flag: FinanceReviewFlag;
  label: string;
  rows: FinanceTransaction[];
}

/** A row stands under every flag it still carries, so clearing one leaves the others in place. */
export function groupForReview(transactions: readonly FinanceTransaction[]): ReviewGroup[] {
  const pending = transactions.map((txn) => ({ txn, flags: unresolvedFlags(txn) }));
  return REVIEW_FLAGS.map((flag) => ({
    flag,
    label: FLAG_LABELS[flag],
    rows: pending.filter((row) => row.flags.includes(flag)).map((row) => row.txn),
  })).filter((group) => group.rows.length > 0);
}

export const withFlagResolved = (txn: FinanceTransaction, flag: FinanceReviewFlag): string[] =>
  txn.resolvedFlags.includes(flag) ? txn.resolvedFlags : [...txn.resolvedFlags, flag];
