import { format, parseISO } from "date-fns";
import type { DayGroup } from "./ledger-grouping";
import type { LedgerRowView } from "./ledger-row";
import { formatCents } from "./money";
import { computeBorneSpendByCategory, computePaidOut, type FinanceBook } from "./queries";

/** Intl hands back a hyphen-minus; money prints a true minus so a negative reads as a figure. */
const TRUE_MINUS = "−";

export const formatSignedCents = (cents: number): string =>
  formatCents(cents).replace("-", TRUE_MINUS);

export const formatDayHeading = (isoDate: string): string =>
  format(parseISO(isoDate), "EEEE, MMM d");

/** The phone abbreviates the weekday where the desktop strip spells it out. */
export const formatCompactDayHeading = (isoDate: string): string =>
  format(parseISO(isoDate), "EEE, MMM d");

/** An excluded row is stated where it bites, never quietly folded into the figure beside it. */
const describeExclusion = (unreviewedCount: number): string =>
  unreviewedCount === 0 ? "" : ` · ${unreviewedCount} unreviewed`;

/** A day whose every row is unreviewed has no honest figure at all — it states the exclusion alone. */
const hasNoSummableRow = (group: DayGroup): boolean => group.unreviewedCount === group.rows.length;

export const describeDayTotals = (group: DayGroup): string =>
  hasNoSummableRow(group)
    ? `${group.unreviewedCount} unreviewed`
    : `${formatSignedCents(group.fullTotalCents)} · your share ${formatSignedCents(group.shareTotalCents)}${describeExclusion(group.unreviewedCount)}`;

/** The phone drops the full-charge figure and names whose the remaining number is. */
export const describeDayShare = (group: DayGroup): string =>
  hasNoSummableRow(group)
    ? `${group.unreviewedCount} unreviewed`
    : `${formatSignedCents(group.shareTotalCents)} yours${describeExclusion(group.unreviewedCount)}`;

/**
 * The phone stacks the desktop's two money columns: the share is the number, and the charge it came
 * out of is the line beneath — or the single word `full` where the share *is* the whole charge.
 */
export const describeMobileCharge = (view: LedgerRowView): string =>
  (view.shareCents ?? view.fullCents) === view.fullCents
    ? "full"
    : `of ${formatSignedCents(view.fullCents)}`;

/** One meta line: the category and how the row splits. A transfer has no category to name. */
export function describeMobileMeta(view: LedgerRowView): string {
  if (view.category.tone === "exempt") return view.metaPhrase;
  if (view.metaPhrase === "") return view.category.label;
  return `${view.category.label} · ${view.metaPhrase}`;
}

/**
 * The two figures are deliberately different numbers, and the sentence labels each: cash actually
 * laid out, then the share budgets see. The budget figure sums the same per-category totals the
 * budget list prints, so the ledger and the budgets never disagree by a rounding cent.
 */
export function describeLedgerSummary(book: FinanceBook, month: string, rowCount: number): string {
  let budgetShareCents = 0;
  for (const cents of computeBorneSpendByCategory(book, month).values()) budgetShareCents += cents;
  const rows = `${rowCount} ${rowCount === 1 ? "row" : "rows"}`;
  const monthName = format(parseISO(`${month}-01`), "MMMM");
  const cashOut = formatCents(computePaidOut(book, month));
  return `${rows} in ${monthName} · ${cashOut} out, ${formatCents(budgetShareCents)} against budgets`;
}
