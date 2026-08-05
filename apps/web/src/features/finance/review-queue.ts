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
  const pending = transactions.map((txn) => ({ txn, flags: unresolvedFlags(txn) }));
  return REVIEW_FLAGS.map((flag) => ({
    flag,
    label: describeFlag(flag),
    rows: pending.filter((row) => row.flags.includes(flag)).map((row) => row.txn),
  })).filter((group) => group.rows.length > 0);
}
