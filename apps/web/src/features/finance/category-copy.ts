import { format, parseISO } from "date-fns";
import type { CategoryCaptionFigures, CategoryMonthRowFigures } from "./category-detail-figures";
import type { UncategorisedFigures } from "./category-table-figures";
import { formatCents } from "./money";
import { shiftMonthKey } from "./month-cursor";
import { formatWholeDollars } from "./primitives";

const SPELLED_COUNTS = [
  "No",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
];

/** Small counts read as words in a sentence; past twelve the digits are easier to take in. */
const spellCount = (count: number): string => SPELLED_COUNTS[count] ?? String(count);

export const formatMonthName = (month: string): string => format(parseISO(`${month}-01`), "MMMM");

export const formatShortMonth = (month: string): string => format(parseISO(`${month}-01`), "MMM");

const countRows = (count: number): string => `${count} ${count === 1 ? "row" : "rows"}`;

const toPercent = (fraction: number): number => Math.round(fraction * 100);

export function describeCategoriesSubLine(count: number, budgetTotalCents: number): string {
  const categories = `${spellCount(count)} ${count === 1 ? "category" : "categories"}`;
  return `${categories} · ${formatCents(budgetTotalCents)} budgeted a month, your share`;
}

/** A spread row is counted in every month it is recognised in, so the count says how many. */
export function describeCategoryRowCount(rowCount: number, spreadCount: number): string {
  const rows = countRows(rowCount);
  return spreadCount === 0 ? rows : `${rows} · ${spreadCount} spread`;
}

export function describeTablePace(
  spentCents: number,
  budgetCents: number,
  elapsedFraction: number,
): string {
  const throughMonth = `${toPercent(elapsedFraction)}% through the month`;
  if (budgetCents <= 0) return `no budget set, ${throughMonth}`;
  return `${toPercent(spentCents / budgetCents)}% spent, ${throughMonth}`;
}

export function describeCarryForward(month: string): string {
  const previous = formatMonthName(shiftMonthKey(month, -1));
  return `${formatMonthName(month)}'s numbers are the ${previous} numbers until you change one. Editing a budget writes a row for this month only; earlier months keep what they were judged against.`;
}

export function describeUncategorised(figures: UncategorisedFigures): string {
  if (figures.rowCount === 0) return "Every row this month is filed under a category.";
  const verb = figures.rowCount === 1 ? "has" : "have";
  return `${countRows(figures.rowCount)} ${verb} no category yet, worth ${formatCents(figures.chargedCents)}. They sit outside every budget until you place them.`;
}

export interface CategoryHeadline {
  text: string;
  isOver: boolean;
}

export interface CategoryHeadlineFigures {
  spentCents: number;
  budgetCents: number | null;
  /** The day the running total first passed the budget, e.g. `Aug 9`, or null when nothing did. */
  breachedOn: string | null;
}

/** The sub-line under the category name: what it has cost, against what it was given. */
export function describeCategoryHeadline(figures: CategoryHeadlineFigures): CategoryHeadline {
  const spent = formatCents(figures.spentCents);
  if (figures.budgetCents === null)
    return { text: `${spent} this month, no budget set`, isOver: false };

  const against = `${spent} of ${formatCents(figures.budgetCents)} this month`;
  if (figures.spentCents > figures.budgetCents) {
    const over = `over by ${formatCents(figures.spentCents - figures.budgetCents)}`;
    const since = figures.breachedOn === null ? "" : ` since ${figures.breachedOn}`;
    return { text: `${against}, ${over}${since}`, isOver: true };
  }
  return {
    text: `${against}, under by ${formatCents(figures.budgetCents - figures.spentCents)}`,
    isOver: false,
  };
}

/**
 * The chart's one sentence. Every figure in it counts completed months only — the month still
 * running is excluded and the caption says so, rather than averaging a part-month in silently.
 */
export function describeCategoryCaption(figures: CategoryCaptionFigures): string {
  if (figures.completedCount === 0)
    return "No completed month on file yet, so nothing to average against.";

  const average = `average ${formatWholeDollars(figures.averageCents)}/mo`;
  const worst =
    figures.worstMonth === null
      ? ""
      : ` · worst ${formatShortMonth(figures.worstMonth)} at ${formatWholeDollars(figures.worstCents)}`;
  const months = `${figures.completedCount} completed ${figures.completedCount === 1 ? "month" : "months"}`;
  const breaches =
    figures.breachedCount === 0
      ? `No breach in ${months}`
      : `Over budget in ${figures.breachedCount} of ${months}`;
  return `${breaches} · ${average}${worst}`;
}

export function describeCategoryMonthFooter(figures: CategoryMonthRowFigures): string {
  const clauses = [countRows(figures.rowCount)];
  if (figures.sharedCount > 0) clauses.push(`${figures.sharedCount} shared`);
  if (figures.comesBackCents !== 0)
    clauses.push(`${formatCents(figures.comesBackCents)} comes back at settle-up`);
  return clauses.join(" · ");
}

export const describeCategoryOverflow = (hiddenCount: number, month: string): string =>
  `${hiddenCount} more in ${formatMonthName(month)}`;

export const describeConcentrationTail = (othersCount: number): string =>
  `${othersCount} ${othersCount === 1 ? "other" : "others"}`;
