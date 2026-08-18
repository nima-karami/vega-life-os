import type { FinanceCategory } from "@vega/shared";
import { computeBorneSpendSeries } from "../dashboard-charts";
import type { BudgetedCategoryFigures } from "../dashboard-figures";
import { shiftMonthKey } from "../month-cursor";
import { type FinanceBook, type FinanceQueryOptions, resolveEffectiveBudgets } from "../queries";
import type { TrendSample } from "./chart-geometry";

/** The `count` months ending at `month`, oldest first. */
export function listMonthsEndingAt(month: string, count: number): string[] {
  const months: string[] = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) months.push(shiftMonthKey(month, -offset));
  return months;
}

export interface TrendWindow {
  months: string[];
  spendByMonth: Map<string, Map<string, number>>;
  budgetsByMonth: Map<string, Map<string, number>>;
}

/**
 * Spend and the budget in force, for every month the trend chart plots — the spend side is one
 * pass over the ledger rather than one per month.
 */
export function buildTrendWindow(
  book: FinanceBook,
  months: string[],
  options: FinanceQueryOptions = {},
): TrendWindow {
  const budgetsByMonth = new Map<string, Map<string, number>>();
  for (const month of months) {
    const budgets = new Map<string, number>();
    for (const [categoryId, budget] of resolveEffectiveBudgets(book, month))
      budgets.set(categoryId, budget.cents);
    budgetsByMonth.set(month, budgets);
  }
  return { months, spendByMonth: computeBorneSpendSeries(book, months, options), budgetsByMonth };
}

export function selectTrendSamples(
  window: TrendWindow,
  categoryId: string,
  openMonth: string,
): TrendSample[] {
  return window.months.map((month) => ({
    month,
    cents: window.spendByMonth.get(month)?.get(categoryId) ?? 0,
    budgetCents: window.budgetsByMonth.get(month)?.get(categoryId) ?? null,
    isOpen: month >= openMonth,
  }));
}

/**
 * Which categories earn a switch chip: the biggest spenders over the window, in palette order so
 * the chip row doesn't reshuffle as the months move.
 */
export function rankTrendCategories(
  window: TrendWindow,
  categories: FinanceCategory[],
  limit: number,
): FinanceCategory[] {
  const totals = new Map<string, number>();
  for (const spend of window.spendByMonth.values()) {
    for (const [categoryId, cents] of spend)
      totals.set(categoryId, (totals.get(categoryId) ?? 0) + cents);
  }
  return categories
    .filter((category) => (totals.get(category.id) ?? 0) > 0)
    .sort((left, right) => (totals.get(right.id) ?? 0) - (totals.get(left.id) ?? 0))
    .slice(0, limit)
    .sort((left, right) => left.order - right.order);
}

/** The category running furthest past its own budget — the one the burn caption names. */
export function findDriftCategory(rows: BudgetedCategoryFigures[]): string | null {
  let worst: BudgetedCategoryFigures | null = null;
  let widest = 0;
  for (const row of rows) {
    if (row.projectedCents === null) continue;
    const gap = row.projectedCents - row.budgetCents;
    if (gap > widest) {
      widest = gap;
      worst = row;
    }
  }
  return worst?.name ?? null;
}
