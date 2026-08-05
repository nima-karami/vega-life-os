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
  subtractCentsFractions,
  ZERO_CENTS,
} from "./money";
import { monthOfISO } from "./month-cursor";

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

const monthStart = (month: string) => parseISO(`${month}-01`);

const spreadMonthsOf = (txn: FinanceTransaction) => Math.max(1, Math.trunc(txn.spreadMonths));
const shareBpsOf = (txn: FinanceTransaction) => (txn.isHousehold ? txn.myShareBps : FULL_SHARE_BPS);

/** Money out is negative on the row; every derived spend figure is a positive magnitude. */
const borneCents = (txn: FinanceTransaction) => -txn.amountCents;

/**
 * Non-internal rows on accounts that count towards the owner's personal figures. Partner-paid
 * rows carry no account, so they are always in.
 */
function selectPersonalRows(book: FinanceBook, options: FinanceQueryOptions): FinanceTransaction[] {
  const businessAccountIds = new Set(
    book.financeAccounts.filter((account) => account.isBusiness).map((account) => account.id),
  );
  return book.financeTransactions.filter((txn) => {
    if (txn.isInternal) return false;
    if (options.includeBusiness || txn.accountId === null) return true;
    return !businessAccountIds.has(txn.accountId);
  });
}

const findCategory = (book: FinanceBook, categoryId: string | null) =>
  categoryId === null ? undefined : book.financeCategories.find((cat) => cat.id === categoryId);

const isCategoryOfKind = (
  book: FinanceBook,
  categoryId: string | null,
  kind: FinanceCategory["kind"],
) => findCategory(book, categoryId)?.kind === kind;

/** Cash basis: one period key, and it is always `txnDate`. */
const isInMonth = (txn: FinanceTransaction, month: string) => monthOfISO(txn.txnDate) === month;

/** How many months after its own a row is recognised in; -1 once it is out of the schedule. */
function recognitionOffset(txn: FinanceTransaction, month: string): number {
  const offset = differenceInCalendarMonths(monthStart(month), monthStart(monthOfISO(txn.txnDate)));
  return offset >= 0 && offset < spreadMonthsOf(txn) ? offset : -1;
}

/**
 * One instalment of an amortized row. The instalments sum to the full borne amount — the
 * remainder an even split leaves over lands on the first month rather than going missing.
 */
function recogniseInstalment(txn: FinanceTransaction, offset: number): CentsFraction {
  const borne = computeShareFraction(borneCents(txn), shareBpsOf(txn));
  const spread = spreadMonthsOf(txn);
  if (spread === 1) return borne;
  const instalment = fromCents(roundToCents(scaleCentsFraction(borne, 1n, BigInt(spread))));
  if (offset > 0) return instalment;
  return subtractCentsFractions(borne, scaleCentsFraction(instalment, BigInt(spread - 1), 1n));
}

function sumBorneSpend(
  book: FinanceBook,
  month: string,
  categoryId: string,
  options: FinanceQueryOptions,
): CentsFraction {
  if (!isCategoryOfKind(book, categoryId, "spend")) return ZERO_CENTS;
  let total = ZERO_CENTS;
  for (const txn of selectPersonalRows(book, options)) {
    if (txn.categoryId !== categoryId) continue;
    const offset = recognitionOffset(txn, month);
    if (offset < 0) continue;
    total = addCentsFractions(total, recogniseInstalment(txn, offset));
  }
  return total;
}

/**
 * The budget number: what the owner actually bears in a category that month, at their share,
 * amortized across `spreadMonths` so the instalments sum back to the full amount. Money-in rows
 * in the category (refunds, rebates) net against it. Amortization is a budget lens only — it
 * never moves cash flow or settlement.
 */
export function computeBorneSpend(
  book: FinanceBook,
  month: string,
  categoryId: string,
  options: FinanceQueryOptions = {},
): number {
  return roundToCents(sumBorneSpend(book, month, categoryId, options));
}

/** Budgets are sparse rows: the effective one is the latest at or before the target month. */
export function resolveEffectiveBudget(
  book: FinanceBook,
  categoryId: string,
  month: string,
): FinanceBudget | null {
  let effective: FinanceBudget | null = null;
  for (const budget of book.financeBudgets) {
    if (budget.categoryId !== categoryId || budget.month > month) continue;
    if (effective === null || budget.month > effective.month) effective = budget;
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
  let total = 0;
  for (const txn of selectPersonalRows(book, options)) {
    if (txn.payer !== "me" || txn.amountCents <= 0 || !isInMonth(txn, month)) continue;
    if (!isCategoryOfKind(book, txn.categoryId, "income")) continue;
    total += txn.amountCents;
  }
  return total;
}

/** Every household row of the month, whatever the account — a debt is never a personal figure. */
const selectHouseholdRows = (book: FinanceBook, month: string) =>
  book.financeTransactions.filter(
    (txn) => !txn.isInternal && txn.isHousehold && isInMonth(txn, month),
  );

function sumTrueShare(rows: FinanceTransaction[]): CentsFraction {
  let total = ZERO_CENTS;
  for (const txn of rows) {
    total = addCentsFractions(total, computeShareFraction(borneCents(txn), txn.myShareBps));
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

function countElapsedDays(month: string, asOf: Date, daysInMonth: number): number {
  const offset = differenceInCalendarMonths(asOf, monthStart(month));
  if (offset !== 0) return daysInMonth;
  return Math.min(Math.max(getDate(asOf), 1), daysInMonth);
}

/** Naive run-rate — the caller labels it an estimate. A month other than `asOf`'s is not projected. */
export function projectMonthEnd(
  book: FinanceBook,
  month: string,
  categoryId: string,
  asOf: Date,
  options: FinanceQueryOptions = {},
): number {
  const daysInMonth = getDaysInMonth(monthStart(month));
  const elapsed = countElapsedDays(month, asOf, daysInMonth);
  const borne = sumBorneSpend(book, month, categoryId, options);
  return roundToCents(scaleCentsFraction(borne, BigInt(daysInMonth), BigInt(elapsed)));
}
