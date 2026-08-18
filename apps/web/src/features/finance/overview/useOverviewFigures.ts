import type { FinanceCategory } from "@vega/shared";
import { format, getDaysInMonth, parseISO } from "date-fns";
import { useMemo, useState } from "react";
import {
  type CumulativeBurnFigures,
  computeCategoryBreachDays,
  computeCumulativeBurn,
  computeStackedMonthlySeries,
  type StackedMonthColumn,
} from "../dashboard-charts";
import {
  type CashFlowFigures,
  deriveCashFlow,
  deriveCategoryBreakdown,
  deriveSection,
  type UntrackedCategoryFigures,
} from "../dashboard-figures";
import { toMonthKey } from "../month-cursor";
import { computeMonthElapsedFraction, getCategoryColor } from "../primitives";
import type { FinanceBook } from "../queries";
import { computeSettlementFigures, type SettlementFigures } from "../settlement";
import { formatDayLabel } from "./BudgetBurnCard";
import type { TrendCategory } from "./CategoryTrendCard";
import type { TrendSample } from "./chart-geometry";
import type { BudgetListRow } from "./FinanceBudgetCard";
import type { BudgetTotals } from "./FinanceOverviewDesktop";
import { describeBudgetStatus } from "./overview-copy";
import {
  buildTrendWindow,
  findDriftCategory,
  listMonthsEndingAt,
  rankTrendCategories,
  selectTrendSamples,
} from "./overview-figures";

const TREND_MONTHS = 8;
const STACKED_MONTHS = 6;
const TREND_CHIPS = 4;
const FALLBACK_COLOR = "#5C8A6E";

export interface OverviewFigures {
  monthLabel: string;
  daysInMonth: number;
  elapsedFraction: number;
  openMonth: string;
  cash: CashFlowFigures | null;
  budget: BudgetTotals | null;
  untracked: UntrackedCategoryFigures[];
  burn: CumulativeBurnFigures | null;
  driftCategory: string | null;
  stackedColumns: StackedMonthColumn[] | null;
  legendCategories: TrendCategory[];
  trendCategories: TrendCategory[];
  trendSamples: TrendSample[];
  selectedTrendId: string | null;
  selectTrendCategory: (categoryId: string) => void;
  settlement: SettlementFigures | null;
}

export interface OverviewFiguresInput {
  book: FinanceBook;
  month: string;
  asOf: Date;
  includeBusiness: boolean;
  focusCategory: FinanceCategory | null;
}

const listSpendCategories = (book: FinanceBook): FinanceCategory[] =>
  book.financeCategories
    .filter((category) => category.kind === "spend" && category.archivedAt === null)
    .sort((left, right) => left.order - right.order);

/**
 * Every figure the overview renders, derived once per book/month/scope. The whole ledger is walked
 * for each of these, so a bare call in the tree would re-walk it on every keystroke and store write.
 */
export function useOverviewFigures({
  book,
  month,
  asOf,
  includeBusiness,
  focusCategory,
}: OverviewFiguresInput): OverviewFigures {
  const [pickedTrendId, setPickedTrendId] = useState<string | null>(null);
  const options = useMemo(() => ({ includeBusiness }), [includeBusiness]);
  const monthStart = parseISO(`${month}-01`);
  const daysInMonth = getDaysInMonth(monthStart);
  const openMonth = toMonthKey(asOf);

  const cash = useMemo(() => deriveCashFlow(book, month, options), [book, month, options]);
  const breakdown = useMemo(
    () => deriveCategoryBreakdown(book, month, asOf, options),
    [book, month, asOf, options],
  );
  const burn = useMemo(
    () => computeCumulativeBurn(book, month, asOf, options),
    [book, month, asOf, options],
  );
  const stacked = useMemo(
    () =>
      computeStackedMonthlySeries(
        book,
        listMonthsEndingAt(month, STACKED_MONTHS),
        STACKED_MONTHS,
        options,
      ),
    [book, month, options],
  );
  const settlement = useMemo(
    () => deriveSection(() => computeSettlementFigures(book, month)),
    [book, month],
  );

  const colors = useMemo(
    () =>
      new Map(book.financeCategories.map((category) => [category.id, getCategoryColor(category)])),
    [book.financeCategories],
  );
  const paint = (categories: FinanceCategory[]): TrendCategory[] =>
    categories.map((category) => ({
      id: category.id,
      name: category.name,
      color: colors.get(category.id) ?? FALLBACK_COLOR,
    }));

  const budget = useMemo<BudgetTotals | null>(() => {
    if (breakdown.status !== "ok") return null;
    const inScope = breakdown.figures.budgeted.filter(
      (row) => focusCategory === null || row.id === focusCategory.id,
    );
    const breachDays = computeCategoryBreachDays(
      book,
      month,
      new Map(inScope.map((row) => [row.id, row.budgetCents])),
      options,
    );
    const rows: BudgetListRow[] = inScope.map((row) => {
      const breachDay = breachDays.get(row.id);
      return {
        id: row.id,
        name: row.name,
        color: colors.get(row.id) ?? FALLBACK_COLOR,
        spentCents: row.spentCents,
        budgetCents: row.budgetCents,
        status: describeBudgetStatus(row, {
          monthEnd: formatDayLabel(month, daysInMonth),
          breachedOn: breachDay === undefined ? null : formatDayLabel(month, breachDay),
        }),
      };
    });
    return {
      rows,
      spentCents: rows.reduce((sum, row) => sum + row.spentCents, 0),
      budgetCents: rows.reduce((sum, row) => sum + row.budgetCents, 0),
    };
  }, [breakdown, book, month, options, focusCategory, colors, daysInMonth]);

  const trendWindow = useMemo(
    () => buildTrendWindow(book, listMonthsEndingAt(month, TREND_MONTHS), options),
    [book, month, options],
  );
  const trendCategories = paint(
    rankTrendCategories(trendWindow, listSpendCategories(book), TREND_CHIPS),
  );
  const selectedTrendId =
    trendCategories.find((category) => category.id === pickedTrendId)?.id ??
    trendCategories[0]?.id ??
    null;
  const trendSamples = useMemo(
    () =>
      selectedTrendId === null ? [] : selectTrendSamples(trendWindow, selectedTrendId, openMonth),
    [trendWindow, selectedTrendId, openMonth],
  );

  return {
    monthLabel: format(monthStart, "MMMM"),
    daysInMonth,
    elapsedFraction: computeMonthElapsedFraction(month, asOf),
    openMonth,
    cash: cash.status === "ok" ? cash.figures : null,
    budget,
    untracked:
      breakdown.status === "ok"
        ? breakdown.figures.untracked.filter(
            (row) => focusCategory === null || row.id === focusCategory.id,
          )
        : [],
    burn: burn.status === "ok" ? burn.figures : null,
    driftCategory: breakdown.status === "ok" ? findDriftCategory(breakdown.figures.budgeted) : null,
    stackedColumns: stacked.status === "ok" ? stacked.figures : null,
    legendCategories: paint(listSpendCategories(book)),
    trendCategories,
    trendSamples,
    selectedTrendId,
    selectTrendCategory: setPickedTrendId,
    settlement: settlement.status === "ok" ? settlement.figures : null,
  };
}
