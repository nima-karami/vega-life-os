import type {
  FinanceAccount,
  FinanceBudget,
  FinanceCategory,
  FinanceSettlement,
  FinanceTransaction,
} from "@vega/shared";
import { differenceInCalendarMonths, getDate, getDaysInMonth, parseISO } from "date-fns";
import {
  addCentsFractions,
  type CentsFraction,
  computeShareFraction,
  FULL_SHARE_BPS,
  fromCents,
  roundToCents,
  scaleCentsFraction,
  ZERO_CENTS,
} from "./money";
import { monthOfISO, shiftMonthKey } from "./month-cursor";

/**
 * The finance collections a derived figure needs, named as the store holds them so a caller
 * can hand the module its state directly. Pure in, numbers out — no store, no persistence.
 */
export interface FinanceBook {
  financeAccounts: FinanceAccount[];
  financeCategories: FinanceCategory[];
  financeBudgets: FinanceBudget[];
  financeTransactions: FinanceTransaction[];
  financeSettlements: FinanceSettlement[];
}

export interface FinanceQueryOptions {
  /**
   * Business accounts sit outside the *personal* figures unless the caller opts in. The
   * household and settlement figures never take this option — business spending must not
   * pollute a budget, but it must never erase a debt either.
   */
  includeBusiness?: boolean;
}

const computeMonthStart = (month: string) => parseISO(`${month}-01`);

const getSpreadMonths = (txn: FinanceTransaction) => Math.max(1, Math.trunc(txn.spreadMonths));
const getShareBps = (txn: FinanceTransaction) =>
  txn.isHousehold ? txn.myShareBps : FULL_SHARE_BPS;

/** Money out is negative on the row; every derived spend figure is a positive magnitude. */
const computeBorneCents = (txn: FinanceTransaction) => -txn.amountCents;

/**
 * Non-internal rows on accounts that count towards the owner's personal figures. Partner-paid
 * rows carry no account, so they are always in.
 */
export function selectPersonalRows(
  book: FinanceBook,
  options: FinanceQueryOptions,
): FinanceTransaction[] {
  const businessAccountIds = new Set(
    book.financeAccounts.filter((account) => account.isBusiness).map((account) => account.id),
  );
  return book.financeTransactions.filter((txn) => {
    if (txn.isInternal) return false;
    if (options.includeBusiness || txn.accountId === null) return true;
    return !businessAccountIds.has(txn.accountId);
  });
}

/** Looked up once per figure, not once per row — a `find` per row is a scan per row. */
export const selectCategoryIdsOfKind = (
  book: FinanceBook,
  kind: FinanceCategory["kind"],
): Set<string> =>
  new Set(
    book.financeCategories
      .filter((category) => category.kind === kind)
      .map((category) => category.id),
  );

/** Cash basis: one period key, and it is always `txnDate`. */
const isInMonth = (txn: FinanceTransaction, month: string) => monthOfISO(txn.txnDate) === month;

/**
 * One instalment of an amortized row. The instalments sum to the *once-rounded* borne amount —
 * the remainder an even split leaves over lands on the first month, computed off the rounded
 * total rather than the raw fraction, so a residual that crosses zero at the half never rounds
 * the first slice negative.
 */
function recogniseInstalment(txn: FinanceTransaction, offset: number): CentsFraction {
  const borne = computeShareFraction(computeBorneCents(txn), getShareBps(txn));
  const spread = getSpreadMonths(txn);
  if (spread === 1) return borne;
  const instalmentCents = roundToCents(scaleCentsFraction(borne, 1n, BigInt(spread)));
  if (offset > 0) return fromCents(instalmentCents);
  return fromCents(roundToCents(borne) - instalmentCents * (spread - 1));
}

export interface RecognizedInstalment {
  month: string;
  offset: number;
  cents: CentsFraction;
}

/**
 * Every month a row is recognised in, spread or not — the one place that walks a row's own
 * schedule forward from its own date, so a caller asking for one month or twelve months walks
 * the same rows once instead of asking this schedule over and over per target month.
 */
export function listRecognizedInstalments(txn: FinanceTransaction): RecognizedInstalment[] {
  const startMonth = monthOfISO(txn.txnDate);
  const spread = getSpreadMonths(txn);
  const instalments: RecognizedInstalment[] = [];
  for (let offset = 0; offset < spread; offset += 1) {
    instalments.push({
      month: shiftMonthKey(startMonth, offset),
      offset,
      cents: recogniseInstalment(txn, offset),
    });
  }
  return instalments;
}

/**
 * A category×month matrix in one pass over the ledger — every row visits its own (bounded)
 * schedule once, rather than the ledger being scanned once per requested month.
 */
export function sumBorneSpendAcrossMonths(
  book: FinanceBook,
  months: string[],
  options: FinanceQueryOptions,
): Map<string, Map<string, CentsFraction>> {
  const spendCategoryIds = selectCategoryIdsOfKind(book, "spend");
  const wantedMonths = new Set(months);
  const matrix = new Map<string, Map<string, CentsFraction>>();
  for (const txn of selectPersonalRows(book, options)) {
    const categoryId = txn.categoryId;
    if (categoryId === null || !spendCategoryIds.has(categoryId)) continue;
    for (const instalment of listRecognizedInstalments(txn)) {
      if (!wantedMonths.has(instalment.month)) continue;
      const monthTotals = matrix.get(instalment.month) ?? new Map<string, CentsFraction>();
      monthTotals.set(
        categoryId,
        addCentsFractions(monthTotals.get(categoryId) ?? ZERO_CENTS, instalment.cents),
      );
      matrix.set(instalment.month, monthTotals);
    }
  }
  return matrix;
}

/** One month of the matrix above — the shape every single-month reader here wants. */
function sumBorneSpendByCategory(
  book: FinanceBook,
  month: string,
  options: FinanceQueryOptions,
): Map<string, CentsFraction> {
  return sumBorneSpendAcrossMonths(book, [month], options).get(month) ?? new Map();
}

/**
 * The budget number: what the owner actually bears in each category that month, at their share,
 * amortized across `spreadMonths` so the instalments sum back to the full amount. Money-in rows
 * in the category (refunds, rebates) net against it. Amortization is a budget lens only — it
 * never moves cash flow or settlement.
 */
export function computeBorneSpendByCategory(
  book: FinanceBook,
  month: string,
  options: FinanceQueryOptions = {},
): Map<string, number> {
  const spend = new Map<string, number>();
  for (const [categoryId, total] of sumBorneSpendByCategory(book, month, options)) {
    spend.set(categoryId, roundToCents(total));
  }
  return spend;
}

/** Budgets are sparse rows: the effective one is the latest at or before the target month. */
export function resolveEffectiveBudgets(
  book: FinanceBook,
  month: string,
): Map<string, FinanceBudget> {
  const effective = new Map<string, FinanceBudget>();
  for (const budget of book.financeBudgets) {
    if (budget.month > month) continue;
    const known = effective.get(budget.categoryId);
    if (known === undefined || budget.month > known.month) effective.set(budget.categoryId, budget);
  }
  return effective;
}

/** Cash actually laid out by the owner that month, at full amount whatever the share. */
export function computePaidOut(
  book: FinanceBook,
  month: string,
  options: FinanceQueryOptions = {},
): number {
  let total = 0;
  for (const txn of selectPersonalRows(book, options)) {
    if (txn.payer !== "me" || txn.amountCents >= 0 || !isInMonth(txn, month)) continue;
    total -= txn.amountCents;
  }
  return total;
}

/**
 * Income only. Refunds are deliberately out — they already net inside `computeBorneSpend`, and
 * counting them both ways double-counts the in/out/net strip.
 */
export function computeCashIn(
  book: FinanceBook,
  month: string,
  options: FinanceQueryOptions = {},
): number {
  const incomeCategoryIds = selectCategoryIdsOfKind(book, "income");
  let total = 0;
  for (const txn of selectPersonalRows(book, options)) {
    if (txn.payer !== "me" || txn.amountCents <= 0 || !isInMonth(txn, month)) continue;
    if (txn.categoryId === null || !incomeCategoryIds.has(txn.categoryId)) continue;
    total += txn.amountCents;
  }
  return total;
}

/** Every household row of the month, whatever the account — a debt is never a personal figure. */
export const selectHouseholdRows = (book: FinanceBook, month: string) =>
  book.financeTransactions.filter(
    (txn) => !txn.isInternal && txn.isHousehold && isInMonth(txn, month),
  );

function sumTrueShare(rows: FinanceTransaction[]): CentsFraction {
  let total = ZERO_CENTS;
  for (const txn of rows) {
    total = addCentsFractions(total, computeShareFraction(computeBorneCents(txn), txn.myShareBps));
  }
  return total;
}

/** The household month, either payer, at full amount — settlement never spreads. */
export function computeHouseholdTotal(book: FinanceBook, month: string): number {
  let total = 0;
  for (const txn of selectHouseholdRows(book, month)) total -= txn.amountCents;
  return total;
}

/** The owner's own share of the household month, whoever paid. */
export function computeMyTrueShare(book: FinanceBook, month: string): number {
  return roundToCents(sumTrueShare(selectHouseholdRows(book, month)));
}

/**
 * What the partner owes the owner: what the owner laid out for the household, less the owner's
 * own share, plus anything carried in, less what has already been paid. Negative means the owner
 * owes the partner — a real case, not a guard.
 *
 * Built from the same rounded share the screen shows, so the strip always adds up; a sub-cent
 * difference matters far less than a total the owner can't reconcile by eye.
 */
export function computeSettlementBalance(book: FinanceBook, month: string): number {
  const rows = selectHouseholdRows(book, month);
  let ownerPaid = 0;
  for (const txn of rows) if (txn.payer === "me") ownerPaid -= txn.amountCents;
  const settlement = book.financeSettlements.find((entry) => entry.month === month);
  const carried = settlement?.carriedDeltaCents ?? 0;
  const paid = settlement?.paidCents ?? 0;
  return ownerPaid - roundToCents(sumTrueShare(rows)) + carried - paid;
}

export function countElapsedDays(month: string, asOf: Date, daysInMonth: number): number {
  const offset = differenceInCalendarMonths(asOf, computeMonthStart(month));
  if (offset !== 0) return daysInMonth;
  return Math.min(Math.max(getDate(asOf), 1), daysInMonth);
}

export interface CategorySpend {
  spentCents: number;
  /** Naive run-rate — the caller labels it an estimate. Outside `asOf`'s month it equals the spend. */
  projectedCents: number;
}

/**
 * Both figures off the one unrounded pass, so the projection scales the exact month-to-date and
 * rounds once — projecting an already-rounded total drifts, and the run-rate compounds the drift.
 */
export function computeMonthSpend(
  book: FinanceBook,
  month: string,
  asOf: Date,
  options: FinanceQueryOptions = {},
): Map<string, CategorySpend> {
  const daysInMonth = getDaysInMonth(computeMonthStart(month));
  const elapsed = countElapsedDays(month, asOf, daysInMonth);
  const figures = new Map<string, CategorySpend>();
  for (const [categoryId, total] of sumBorneSpendByCategory(book, month, options)) {
    figures.set(categoryId, {
      spentCents: roundToCents(total),
      projectedCents: roundToCents(scaleCentsFraction(total, BigInt(daysInMonth), BigInt(elapsed))),
    });
  }
  return figures;
}
