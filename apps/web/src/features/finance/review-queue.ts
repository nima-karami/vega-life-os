import type { FinanceTransaction } from "@vega/shared";
import {
  describeFlag,
  type FinanceReviewFlag,
  REVIEW_FLAGS,
  unresolvedFlags,
} from "./review-flags";

export interface ReviewGroup {
  flag: FinanceReviewFlag;
  label: string;
  rows: FinanceTransaction[];
}

/** A row stands under every flag it still carries, so clearing one leaves the others in place. */
export function groupForReview(transactions: readonly FinanceTransaction[]): ReviewGroup[] {
  const pendingRows = transactions.map((txn) => ({ txn, flags: unresolvedFlags(txn) }));
  return REVIEW_FLAGS.map((flag) => ({
    flag,
    label: describeFlag(flag),
    rows: pendingRows.filter((row) => row.flags.includes(flag)).map((row) => row.txn),
  })).filter((group) => group.rows.length > 0);
}

/** The ledger's page size, for the same reason: every queued row mounts its own category picker. */
export const REVIEW_PAGE_SIZE = 200;

export interface ReviewPageGroup extends ReviewGroup {
  /** how many rows the group holds in full, not just on this page */
  total: number;
}

export interface ReviewPage {
  groups: ReviewPageGroup[];
  total: number;
  remaining: number;
}

/** One budget of rows spent across the groups in order, so a group is never half-hidden silently. */
export function pageReviewGroups(groups: ReviewGroup[], visibleCount: number): ReviewPage {
  const total = groups.reduce((sum, group) => sum + group.rows.length, 0);
  let budget = visibleCount;
  const paged: ReviewPageGroup[] = [];
  for (const group of groups) {
    if (budget <= 0) break;
    paged.push({ ...group, rows: group.rows.slice(0, budget), total: group.rows.length });
    budget -= group.rows.length;
  }
  return { groups: paged, total, remaining: Math.max(0, total - visibleCount) };
}
