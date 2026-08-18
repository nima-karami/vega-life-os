import type { FinanceTransaction } from "@vega/shared";
import { format, parseISO } from "date-fns";
import { computeShareFraction, HOUSEHOLD_DEFAULT_BPS, roundToCents } from "./money";
import { formatMonthLabel } from "./month-cursor";
import { type FinanceBook, selectHouseholdRows } from "./queries";
import { hasUnresolvedFlags } from "./review-flags";
import { computeSettlementFigures, type SettlementFigures } from "./settlement";
import { describeSettlementOutcome, type SettlementOutcome } from "./settlement-copy";
import { resolveTransactionTitle } from "./transactions-query";

export interface SettlementRowView {
  id: string;
  dateLabel: string;
  title: string;
  isOwnerPaid: boolean;
  /** Positive on a charge, negative on a refund — the sign travels through every figure below. */
  fullCents: number;
  shareBps: number;
  /** Null while the row waits on a split: a share nobody has agreed to is shown, never guessed. */
  shareCents: number | null;
  /** Positive when the partner owes the owner for this row, negative when the owner owes. */
  owedCents: number | null;
  isWaiting: boolean;
}

export type SettlementRowFilter = "all" | "owner" | "partner" | "waiting";

function buildRowView(txn: FinanceTransaction): SettlementRowView {
  const fullCents = -txn.amountCents;
  const isWaiting = hasUnresolvedFlags(txn);
  const shareCents = isWaiting
    ? null
    : roundToCents(computeShareFraction(fullCents, txn.myShareBps));
  const isOwnerPaid = txn.payer === "me";
  const owedShare = shareCents === null ? null : isOwnerPaid ? fullCents - shareCents : -shareCents;

  return {
    id: txn.id,
    dateLabel: format(parseISO(txn.txnDate), "MMM d"),
    title: resolveTransactionTitle(txn),
    isOwnerPaid,
    fullCents,
    shareBps: txn.myShareBps,
    shareCents,
    owedCents: owedShare,
    isWaiting,
  };
}

/** Every household row of the period, newest first, with a stable id tiebreak on a shared day. */
export function buildSettlementRowViews(book: FinanceBook, month: string): SettlementRowView[] {
  return selectHouseholdRows(book, month)
    .slice()
    .sort(
      (left, right) => right.txnDate.localeCompare(left.txnDate) || left.id.localeCompare(right.id),
    )
    .map(buildRowView);
}

export function filterSettlementRows(
  views: SettlementRowView[],
  filter: SettlementRowFilter,
): SettlementRowView[] {
  if (filter === "all") return views;
  if (filter === "waiting") return views.filter((view) => view.isWaiting);
  return views.filter((view) => view.isOwnerPaid === (filter === "owner"));
}

export interface SettlementSplitPartition {
  evenCount: number;
  evenCents: number;
  otherCount: number;
  otherCents: number;
}

/**
 * The two stat boxes that partition the rows carrying a split. The third box is the exclusion set
 * the figures already carry, so the screen never counts the waiting rows twice.
 */
export function partitionSettlementSplits(views: SettlementRowView[]): SettlementSplitPartition {
  const partition: SettlementSplitPartition = {
    evenCount: 0,
    evenCents: 0,
    otherCount: 0,
    otherCents: 0,
  };
  for (const view of views) {
    if (view.isWaiting) continue;
    if (view.shareBps === HOUSEHOLD_DEFAULT_BPS) {
      partition.evenCount += 1;
      partition.evenCents += view.fullCents;
    } else {
      partition.otherCount += 1;
      partition.otherCents += view.fullCents;
    }
  }
  return partition;
}

/**
 * What the rows alone leave owing — the `Owed you` column's net. Read off the tested figures rather
 * than re-summed, so the footer and the headline can never disagree by a rounding cent. Anything
 * carried in from an earlier period is deliberately out: it belongs to no row on this table.
 */
export const computeRowsNetCents = (figures: SettlementFigures): number =>
  figures.ownerPaidCents - figures.myShareCents;

export interface SettlementHistoryRow {
  month: string;
  periodLabel: string;
  outcome: SettlementOutcome;
  /** A period whose rows moved after it settled carries the amber chip. */
  isAmended: boolean;
  rowCount: number;
  settledLabel: string;
}

const NO_DATE = "—";

/** The closed periods, newest first, each at the figure it was settled at rather than today's. */
export function buildSettlementHistory(
  book: FinanceBook,
  partnerName: string,
): SettlementHistoryRow[] {
  return book.financeSettlements
    .filter((entry) => entry.status !== "open")
    .sort((left, right) => right.month.localeCompare(left.month))
    .map((entry) => {
      const figures = computeSettlementFigures(book, entry.month);
      return {
        month: entry.month,
        periodLabel: formatMonthLabel(entry.month),
        outcome: describeSettlementOutcome(figures.headlineBalanceCents, partnerName),
        isAmended: figures.phase === "amended",
        rowCount: figures.householdRowCount,
        settledLabel:
          entry.settledAt === null ? NO_DATE : format(parseISO(entry.settledAt), "MMM d"),
      };
    });
}
