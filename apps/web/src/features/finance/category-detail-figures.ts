import { computeBorneSpendSeries } from "./dashboard-charts";
import { deriveSection, type FinanceSection } from "./dashboard-figures";
import { normalizeMerchant } from "./import/merchant";
import {
  addCentsFractions,
  type CentsFraction,
  createCentsFraction,
  roundToCents,
  scaleCentsFraction,
  ZERO_CENTS,
} from "./money";
import { shiftMonthKey, toMonthKey } from "./month-cursor";
import {
  type FinanceBook,
  type FinanceQueryOptions,
  listRecognizedInstalments,
  resolveEffectiveBudgets,
  selectPersonalRows,
  sumBorneSpendAcrossMonths,
} from "./queries";

export type CategoryMonthFlag = "over" | "under" | "current-partial";

export interface CategoryMonthFigures {
  month: string;
  spentCents: number;
  budgetCents: number;
  flag: CategoryMonthFlag;
}

/**
 * A month is judged against the budget row that was in force *then* — budgets carry forward, so
 * an earlier month may have answered to a different figure than the one showing today.
 */
export function computeCategoryMonthlySeries(
  book: FinanceBook,
  categoryId: string,
  months: string[],
  asOf: Date,
  options: FinanceQueryOptions = {},
): FinanceSection<CategoryMonthFigures[]> {
  return deriveSection(() => {
    const series = computeBorneSpendSeries(book, months, options);
    const currentMonth = toMonthKey(asOf);
    return months.map((month) => {
      const spentCents = series.get(month)?.get(categoryId) ?? 0;
      const budgetCents = resolveEffectiveBudgets(book, month).get(categoryId)?.cents ?? 0;
      const flag: CategoryMonthFlag =
        month === currentMonth ? "current-partial" : spentCents > budgetCents ? "over" : "under";
      return { month, spentCents, budgetCents, flag };
    });
  });
}

/**
 * The mean over the `monthsBack` months strictly before `month` — the in-progress month is
 * never one of them. A completed month with no rows still counts, at zero, rather than being
 * skipped: skipping it would let a quiet month flatter the average than it earned.
 */
export function computeTrailingCompletedAverage(
  book: FinanceBook,
  categoryId: string,
  month: string,
  monthsBack = 3,
  options: FinanceQueryOptions = {},
): FinanceSection<number> {
  return deriveSection(() => {
    const completedMonths = Array.from({ length: monthsBack }, (_, index) =>
      shiftMonthKey(month, -(index + 1)),
    );
    const matrix = sumBorneSpendAcrossMonths(book, completedMonths, options);
    let total = ZERO_CENTS;
    for (const completedMonth of completedMonths) {
      total = addCentsFractions(total, matrix.get(completedMonth)?.get(categoryId) ?? ZERO_CENTS);
    }
    return roundToCents(scaleCentsFraction(total, 1n, BigInt(monthsBack)));
  });
}

export interface MerchantConcentrationEntry {
  key: string;
  cents: number;
}

export interface MerchantConcentrationFigures {
  entries: MerchantConcentrationEntry[];
  othersCount: number;
  othersCents: number;
}

function sumBorneByMerchant(
  book: FinanceBook,
  categoryId: string,
  month: string,
  options: FinanceQueryOptions,
): Map<string, CentsFraction> {
  const totals = new Map<string, CentsFraction>();
  for (const txn of selectPersonalRows(book, options)) {
    if (txn.categoryId !== categoryId) continue;
    for (const instalment of listRecognizedInstalments(txn)) {
      if (instalment.month !== month) continue;
      const key = txn.merchantId ?? normalizeMerchant(txn.description);
      totals.set(key, addCentsFractions(totals.get(key) ?? ZERO_CENTS, instalment.cents));
    }
  }
  return totals;
}

/**
 * Descending by borne spend, tied merchants ordered by key for a stable read. The tail beyond
 * `topN` collapses into one rounded figure so the listed rows plus the tail sum to the month.
 */
export function computeMerchantConcentration(
  book: FinanceBook,
  categoryId: string,
  month: string,
  topN: number,
  options: FinanceQueryOptions = {},
): FinanceSection<MerchantConcentrationFigures> {
  return deriveSection(() => {
    const totals = sumBorneByMerchant(book, categoryId, month, options);
    const ranked = [...totals.entries()].sort(([leftKey, leftCents], [rightKey, rightCents]) => {
      const byCents = roundToCents(rightCents) - roundToCents(leftCents);
      return byCents !== 0 ? byCents : leftKey.localeCompare(rightKey);
    });
    const tail = ranked.slice(topN);
    const othersTotal = tail.reduce((sum, [, cents]) => addCentsFractions(sum, cents), ZERO_CENTS);
    return {
      entries: ranked.slice(0, topN).map(([key, cents]) => ({ key, cents: roundToCents(cents) })),
      othersCount: tail.length,
      othersCents: roundToCents(othersTotal),
    };
  });
}

export interface CategoryCaptionFigures {
  breachedCount: number;
  completedCount: number;
  averageCents: number;
}

/**
 * Reads off the same rounded bars the chart plots, not a fresh unrounded pass — the caption and
 * the bars must never disagree on which months breached or by how much.
 */
export function computeCategoryCaptionFigures(
  book: FinanceBook,
  categoryId: string,
  months: string[],
  asOf: Date,
  options: FinanceQueryOptions = {},
): FinanceSection<CategoryCaptionFigures> {
  const series = computeCategoryMonthlySeries(book, categoryId, months, asOf, options);
  if (series.status === "failed") return series;
  const completed = series.figures.filter((entry) => entry.flag !== "current-partial");
  const breachedCount = completed.filter((entry) => entry.flag === "over").length;
  const totalSpentCents = completed.reduce((sum, entry) => sum + entry.spentCents, 0);
  const averageCents =
    completed.length === 0
      ? 0
      : roundToCents(createCentsFraction(BigInt(totalSpentCents), BigInt(completed.length)));
  return {
    status: "ok",
    figures: { breachedCount, completedCount: completed.length, averageCents },
  };
}
