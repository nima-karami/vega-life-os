import { formatCents } from "../money";
import { formatWholeDollars } from "../primitives";

export interface BudgetStatusLine {
  text: string;
  isOver: boolean;
}

export interface BudgetStatusRow {
  spentCents: number;
  budgetCents: number;
  /** Null outside the month `asOf` falls in — a finished month has no run rate left. */
  projectedCents: number | null;
}

export interface BudgetStatusLabels {
  /** The scoped month's last day, e.g. `Aug 31`. */
  monthEnd: string;
  /** The day the running total first passed the budget, or null when nothing crossed it. */
  breachedOn: string | null;
}

/**
 * The one line under a category name. Every variant is read off figures already on file — a
 * category with no history says nothing rather than guessing when its bill usually lands.
 */
export function describeBudgetStatus(
  row: BudgetStatusRow,
  labels: BudgetStatusLabels,
): BudgetStatusLine {
  if (row.spentCents > row.budgetCents) {
    const over = `over by ${formatCents(row.spentCents - row.budgetCents)}`;
    return {
      text: labels.breachedOn === null ? over : `${over} · breached ${labels.breachedOn}`,
      isOver: true,
    };
  }
  if (row.spentCents === 0) return { text: "nothing yet this month", isOver: false };
  if (row.projectedCents !== null) {
    const verdict = row.projectedCents > row.budgetCents ? "over at this pace" : "on pace";
    return {
      text: `${verdict} · tracking ${formatWholeDollars(row.projectedCents)} by ${labels.monthEnd}`,
      isOver: false,
    };
  }
  return { text: `under by ${formatCents(row.budgetCents - row.spentCents)}`, isOver: false };
}

export interface TrendCaptionSample {
  cents: number;
  isBreach: boolean;
  isOpen: boolean;
}

const pluralizeMonths = (count: number) => `${count} ${count === 1 ? "month" : "months"}`;

/** The average counts completed months only — a month still running would drag it down. */
export function describeTrendCaption(samples: TrendCaptionSample[]): string {
  const completed = samples.filter((sample) => !sample.isOpen);
  if (completed.length === 0) return "No completed month on file yet — nothing to average against.";

  const total = completed.reduce((sum, sample) => sum + sample.cents, 0);
  const average = `average ${formatWholeDollars(Math.round(total / completed.length))}/mo`;
  const breaches = completed.filter((sample) => sample.isBreach).length;
  if (breaches === 0) return `No month breached its budget · ${average}`;
  return `Red dots are breaches — ${breaches} in ${pluralizeMonths(completed.length)} · ${average}`;
}

export interface BurnCaption {
  text: string;
  isWarning: boolean;
}

export interface BurnCaptionFigures {
  projectedCents: number;
  planEndCents: number;
}

/** Names the category doing the drifting, because "over the plan" alone says nothing to act on. */
export function describeBurnCaption(
  figures: BurnCaptionFigures,
  labels: { monthEnd: string; driftCategory: string | null },
): BurnCaption {
  if (figures.planEndCents <= 0)
    return {
      text: "No budget is in force this month, so there is no plan to track against.",
      isWarning: false,
    };

  const tracking = `Tracking ${formatWholeDollars(figures.projectedCents)} by ${labels.monthEnd}`;
  const plan = formatWholeDollars(figures.planEndCents);
  const gap = figures.projectedCents - figures.planEndCents;
  if (gap <= 0)
    return {
      text: `${tracking} — ${formatWholeDollars(-gap)} under the ${plan} plan.`,
      isWarning: false,
    };

  const drift = labels.driftCategory === null ? "" : ` ${labels.driftCategory} is the drift.`;
  return {
    text: `${tracking} — ${formatWholeDollars(gap)} over the ${plan} plan.${drift}`,
    isWarning: true,
  };
}

/** The phone's one-word verdict beside the spend figure. */
export function describePaceNote(figures: BurnCaptionFigures): BurnCaption {
  if (figures.planEndCents <= 0) return { text: "no plan set", isWarning: false };
  const gap = figures.projectedCents - figures.planEndCents;
  return gap > 0
    ? { text: `${formatWholeDollars(gap)} over pace`, isWarning: true }
    : { text: `${formatWholeDollars(-gap)} under pace`, isWarning: false };
}

/**
 * Rows waiting on a category or a split are stated beside the figure they would have changed,
 * never folded into it.
 */
export function describeExclusions(excludedCount: number, excludedCents: number): string {
  if (excludedCount === 0) return "";
  const rows = excludedCount === 1 ? "1 row" : `${excludedCount} rows`;
  return `${rows} left out — ${formatCents(excludedCents)} still needs a category or a split.`;
}
