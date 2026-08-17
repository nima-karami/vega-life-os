import { getDate, getDaysInMonth, parseISO } from "date-fns";
import { toMonthKey } from "../month-cursor";

export interface PaceBarShape {
  /** 0–1, clamped: how much of the track the fill covers. */
  fillFraction: number;
  /** Zero spend draws the track and the tick and no fill at all — never a `width:0%` element. */
  hasFill: boolean;
  isOverBudget: boolean;
}

/**
 * Over budget drops the category colour entirely and fills the whole track, so a breach reads
 * before the figure does. An unbudgeted category with spend counts as over — nothing was planned.
 */
export function derivePaceBarShape(spentCents: number, budgetCents: number): PaceBarShape {
  const spent = Math.max(spentCents, 0);
  const isOverBudget = spent > Math.max(budgetCents, 0);
  const fillFraction = budgetCents > 0 ? Math.min(spent / budgetCents, 1) : spent > 0 ? 1 : 0;
  return { fillFraction, hasFill: spent > 0, isOverBudget };
}

/**
 * The today tick, as a live fraction of the scoped month — a month already past is fully elapsed
 * and one still ahead has not started, so the tick never lies about where in the month we are.
 */
export function computeMonthElapsedFraction(month: string, asOf: Date): number {
  const today = toMonthKey(asOf);
  if (today > month) return 1;
  if (today < month) return 0;
  return getDate(asOf) / getDaysInMonth(parseISO(`${month}-01`));
}
