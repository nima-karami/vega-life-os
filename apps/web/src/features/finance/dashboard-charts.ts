import { getDate, getDaysInMonth, parseISO } from "date-fns";
import { deriveSection, type FinanceSection } from "./dashboard-figures";
import {
  addCentsFractions,
  type CentsFraction,
  roundToCents,
  scaleCentsFraction,
  ZERO_CENTS,
} from "./money";
import {
  countElapsedDays,
  type FinanceBook,
  type FinanceQueryOptions,
  listRecognizedInstalments,
  resolveEffectiveBudgets,
  selectCategoryIdsOfKind,
  selectPersonalRows,
  sumBorneSpendAcrossMonths,
} from "./queries";

/**
 * A category×month matrix in one pass — the multi-month sibling of `computeBorneSpendByCategory`,
 * for a chart that plots several months at once rather than re-scanning the ledger per month.
 */
export function computeBorneSpendSeries(
  book: FinanceBook,
  months: string[],
  options: FinanceQueryOptions = {},
): Map<string, Map<string, number>> {
  const matrix = sumBorneSpendAcrossMonths(book, months, options);
  const rounded = new Map<string, Map<string, number>>();
  for (const [month, categories] of matrix) {
    const roundedCategories = new Map<string, number>();
    for (const [categoryId, cents] of categories)
      roundedCategories.set(categoryId, roundToCents(cents));
    rounded.set(month, roundedCategories);
  }
  return rounded;
}

function bucketBorneSpendByDay(
  book: FinanceBook,
  month: string,
  options: FinanceQueryOptions,
): Map<number, CentsFraction> {
  const spendCategoryIds = selectCategoryIdsOfKind(book, "spend");
  const totals = new Map<number, CentsFraction>();
  for (const txn of selectPersonalRows(book, options)) {
    if (txn.categoryId === null || !spendCategoryIds.has(txn.categoryId)) continue;
    for (const instalment of listRecognizedInstalments(txn)) {
      if (instalment.month !== month) continue;
      // A row's own month gets its own day; a later month recognised only through spread has
      // no calendar event of its own, so its slice lands on day one of that month.
      const day = instalment.offset === 0 ? getDate(parseISO(txn.txnDate)) : 1;
      totals.set(day, addCentsFractions(totals.get(day) ?? ZERO_CENTS, instalment.cents));
    }
  }
  return totals;
}

export interface CumulativeBurnFigures {
  cumulativeCents: { day: number; cents: number }[];
  planEndCents: number;
  todayFraction: number;
  /** A naive run-rate to month end — an estimate; whether to flag it is the UI's call. */
  projectedCents: number;
}

/**
 * Day one through today, each point rounded once off the true running total so far — summing
 * already-rounded days would drift the line away from the figure it is meant to end on.
 */
export function computeCumulativeBurn(
  book: FinanceBook,
  month: string,
  asOf: Date,
  options: FinanceQueryOptions = {},
): FinanceSection<CumulativeBurnFigures> {
  return deriveSection(() => {
    const dayTotals = bucketBorneSpendByDay(book, month, options);
    const daysInMonth = getDaysInMonth(parseISO(`${month}-01`));
    const elapsed = countElapsedDays(month, asOf, daysInMonth);

    let running = ZERO_CENTS;
    const cumulativeCents: { day: number; cents: number }[] = [];
    for (let day = 1; day <= elapsed; day += 1) {
      running = addCentsFractions(running, dayTotals.get(day) ?? ZERO_CENTS);
      cumulativeCents.push({ day, cents: roundToCents(running) });
    }

    const planEndCents = [...resolveEffectiveBudgets(book, month).values()].reduce(
      (sum, budgetRow) => sum + budgetRow.cents,
      0,
    );
    const projectedCents = roundToCents(
      scaleCentsFraction(running, BigInt(daysInMonth), BigInt(elapsed)),
    );

    return { cumulativeCents, planEndCents, todayFraction: elapsed / daysInMonth, projectedCents };
  });
}

export interface StackedMonthColumn {
  month: string;
  total: number;
  segments: { categoryId: string; cents: number }[];
}

function rankCategoriesBySpend(
  series: Map<string, Map<string, number>>,
  categoryOrder: Map<string, number>,
  topN: number,
): Set<string> {
  const totals = new Map<string, number>();
  for (const categories of series.values()) {
    for (const [categoryId, cents] of categories)
      totals.set(categoryId, (totals.get(categoryId) ?? 0) + cents);
  }
  return new Set(
    [...totals.entries()]
      .sort(([leftId, leftTotal], [rightId, rightTotal]) => {
        const bySpend = rightTotal - leftTotal;
        return bySpend !== 0
          ? bySpend
          : (categoryOrder.get(leftId) ?? 0) - (categoryOrder.get(rightId) ?? 0);
      })
      .slice(0, topN)
      .map(([categoryId]) => categoryId),
  );
}

/**
 * Segments are capped to the `topN` categories by total spend over the window and always sum to
 * the column total — there is no hidden "other" slice here, unlike merchant concentration.
 */
export function computeStackedMonthlySeries(
  book: FinanceBook,
  months: string[],
  topN: number,
  options: FinanceQueryOptions = {},
): FinanceSection<StackedMonthColumn[]> {
  return deriveSection(() => {
    const series = computeBorneSpendSeries(book, months, options);
    const categoryOrder = new Map(
      book.financeCategories.map((category) => [category.id, category.order]),
    );
    const topCategoryIds = rankCategoriesBySpend(series, categoryOrder, topN);

    return months.map((month) => {
      const categories = series.get(month) ?? new Map<string, number>();
      const segments = [...categories.entries()]
        .filter(([categoryId, cents]) => cents !== 0 && topCategoryIds.has(categoryId))
        .sort(
          ([leftId], [rightId]) =>
            (categoryOrder.get(leftId) ?? 0) - (categoryOrder.get(rightId) ?? 0),
        )
        .map(([categoryId, cents]) => ({ categoryId, cents }));
      return { month, total: segments.reduce((sum, entry) => sum + entry.cents, 0), segments };
    });
  });
}
