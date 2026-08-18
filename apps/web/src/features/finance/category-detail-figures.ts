import type { FinanceTransaction } from "@vega/shared";
import { differenceInCalendarMonths, parseISO } from "date-fns";
import { computeBorneSpendSeries } from "./dashboard-charts";
import { deriveSection, type FinanceSection } from "./dashboard-figures";
import { normalizeMerchant } from "./import/merchant";
import {
  addCentsFractions,
  type CentsFraction,
  computeShareFraction,
  createCentsFraction,
  FULL_SHARE_BPS,
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

/** However long the history runs, a chart nobody can read is not honesty — ten years is the cap. */
const MAX_CHART_MONTHS = 120;

function findEarliestMonth(book: FinanceBook, categoryId: string, fallback: string): string {
  const months = [
    ...book.financeTransactions
      .filter((txn) => txn.categoryId === categoryId)
      .map((txn) => txn.txnDate.slice(0, 7)),
    ...book.financeBudgets
      .filter((budget) => budget.categoryId === categoryId)
      .map((budget) => budget.month),
  ].filter((month) => month < fallback);
  return months.reduce((earliest, month) => (month < earliest ? month : earliest), fallback);
}

/**
 * The months a range control asks for, oldest first and always ending at the month on screen.
 * `monthsBack` of null is the whole history the category has, back to its first row or budget.
 */
export function listCategoryMonths(
  book: FinanceBook,
  categoryId: string,
  month: string,
  monthsBack: number | null,
): string[] {
  const earliest = monthsBack === null ? findEarliestMonth(book, categoryId, month) : null;
  const length =
    earliest === null
      ? Math.max(monthsBack ?? 1, 1)
      : Math.min(
          differenceInCalendarMonths(parseISO(`${month}-01`), parseISO(`${earliest}-01`)) + 1,
          MAX_CHART_MONTHS,
        );
  return Array.from({ length }, (_, index) => shiftMonthKey(month, index - (length - 1)));
}

export interface CategoryMonthFigures {
  month: string;
  spentCents: number;
  /** Null when no budget row was ever in force that month — never breached, whatever the spend. */
  budgetCents: number | null;
  flag: CategoryMonthFlag;
}

/**
 * A month is judged against the budget row that was in force *then* — budgets carry forward, so
 * an earlier month may have answered to a different figure than the one showing today. A month
 * with no budget row in force at all is never "over" — a stored budget of zero still breaches on
 * any spend, but the absence of a budget is not the same claim as a budget of zero.
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
      const budgetCents = resolveEffectiveBudgets(book, month).get(categoryId)?.cents ?? null;
      const isOver = budgetCents !== null && spentCents > budgetCents;
      const flag: CategoryMonthFlag =
        month === currentMonth ? "current-partial" : isOver ? "over" : "under";
      return { month, spentCents, budgetCents, flag };
    });
  });
}

const listCompletedMonths = (month: string, monthsBack: number): string[] =>
  Array.from({ length: monthsBack }, (_, index) => shiftMonthKey(month, -(index + 1)));

/**
 * Every category's trailing average in one pass, for a table that would otherwise walk the whole
 * ledger once per row. A completed month with no rows still counts, at zero, rather than being
 * skipped: skipping it would let a quiet month flatter the average than it earned.
 */
export function computeTrailingCompletedAverages(
  book: FinanceBook,
  month: string,
  monthsBack = 3,
  options: FinanceQueryOptions = {},
): FinanceSection<Map<string, number>> {
  return deriveSection(() => {
    const matrix = sumBorneSpendAcrossMonths(book, listCompletedMonths(month, monthsBack), options);
    const totals = new Map<string, CentsFraction>();
    for (const monthTotals of matrix.values()) {
      for (const [categoryId, cents] of monthTotals) {
        totals.set(categoryId, addCentsFractions(totals.get(categoryId) ?? ZERO_CENTS, cents));
      }
    }
    const averages = new Map<string, number>();
    for (const [categoryId, total] of totals) {
      averages.set(categoryId, roundToCents(scaleCentsFraction(total, 1n, BigInt(monthsBack))));
    }
    return averages;
  });
}

/**
 * The mean over the `monthsBack` months strictly before `month` — the in-progress month is
 * never one of them, which is what makes it an honest figure to set next month's budget from.
 */
export function computeTrailingCompletedAverage(
  book: FinanceBook,
  categoryId: string,
  month: string,
  monthsBack = 3,
  options: FinanceQueryOptions = {},
): FinanceSection<number> {
  const averages = computeTrailingCompletedAverages(book, month, monthsBack, options);
  if (averages.status === "failed") return averages;
  return { status: "ok", figures: averages.figures.get(categoryId) ?? 0 };
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
 * `topN` is the *remainder* — the category's once-rounded total minus the shown rows' own
 * rounded figures, never its own independently-rounded sum — so the listed rows plus the tail
 * always reconcile to the month exactly, whatever the per-merchant rounding drift.
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
    const categoryTotalCents = roundToCents(
      ranked.reduce((sum, [, cents]) => addCentsFractions(sum, cents), ZERO_CENTS),
    );
    const entries = ranked
      .slice(0, topN)
      .map(([key, cents]) => ({ key, cents: roundToCents(cents) }));
    const shownCents = entries.reduce((sum, entry) => sum + entry.cents, 0);
    return {
      entries,
      othersCount: ranked.length - entries.length,
      othersCents: categoryTotalCents - shownCents,
    };
  });
}

export interface CategoryCaptionFigures {
  breachedCount: number;
  completedCount: number;
  averageCents: number;
  /** The heaviest completed month, or null while nothing has completed yet. */
  worstMonth: string | null;
  worstCents: number;
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
  const worst = completed.reduce<CategoryMonthFigures | null>(
    (heaviest, entry) =>
      heaviest === null || entry.spentCents > heaviest.spentCents ? entry : heaviest,
    null,
  );
  return {
    status: "ok",
    figures: {
      breachedCount,
      completedCount: completed.length,
      averageCents,
      worstMonth: worst?.month ?? null,
      worstCents: worst?.spentCents ?? 0,
    },
  };
}

export interface CategoryMonthRowFigures {
  rowCount: number;
  sharedCount: number;
  /** What the partner owes on this category's rows this month — a slice of the settlement total. */
  comesBackCents: number;
}

const isDatedIn = (txn: FinanceTransaction, month: string): boolean =>
  txn.txnDate.slice(0, 7) === month;

/** This category's rows for the scoped month, newest first, with a stable id tiebreak on a day. */
export function selectCategoryMonthRows(
  book: FinanceBook,
  categoryId: string,
  month: string,
  options: FinanceQueryOptions = {},
): FinanceTransaction[] {
  return selectPersonalRows(book, options)
    .filter((txn) => txn.categoryId === categoryId && isDatedIn(txn, month))
    .sort(
      (left, right) => right.txnDate.localeCompare(left.txnDate) || left.id.localeCompare(right.id),
    );
}

/** Every household row for this category and month, whatever the account — settlement's own scope. */
function selectCategoryMonthHouseholdRows(
  book: FinanceBook,
  categoryId: string,
  month: string,
): FinanceTransaction[] {
  return book.financeTransactions.filter(
    (txn) =>
      !txn.isInternal && txn.isHousehold && txn.categoryId === categoryId && isDatedIn(txn, month),
  );
}

/**
 * What the month card says under its figure. `comesBackCents` counts only rows the owner paid for
 * — it is the settlement delta in their favour, sliced to this category, never the whole balance.
 * It reads every household row regardless of account, same as settlement does: a household expense
 * on the business card still owes the owner their share back.
 */
export function computeCategoryMonthRowFigures(
  book: FinanceBook,
  categoryId: string,
  month: string,
  options: FinanceQueryOptions = {},
): FinanceSection<CategoryMonthRowFigures> {
  return deriveSection(() => {
    const rows = selectCategoryMonthRows(book, categoryId, month, options);
    let comesBack = ZERO_CENTS;
    for (const txn of selectCategoryMonthHouseholdRows(book, categoryId, month)) {
      if (txn.payer !== "me") continue;
      comesBack = addCentsFractions(
        comesBack,
        computeShareFraction(-txn.amountCents, FULL_SHARE_BPS - txn.myShareBps),
      );
    }
    return {
      rowCount: rows.length,
      sharedCount: rows.filter((txn) => txn.isHousehold).length,
      comesBackCents: roundToCents(comesBack),
    };
  });
}
