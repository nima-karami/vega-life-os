import type {
  FinanceAccount,
  FinanceBudget,
  FinanceCategory,
  FinanceSettlement,
  FinanceTransaction,
} from "@vega/shared";
import { differenceInCalendarMonths, format, getDate, getDaysInMonth, parseISO } from "date-fns";
import {
  addCentsFractions,
  type CentsFraction,
  fromCents,
  makeCentsFraction,
  roundToCents,
  scaleCentsFraction,
  subtractCentsFractions,
  ZERO_CENTS,
} from "./money";

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
  /** Business accounts sit outside the personal figures unless the caller opts in. */
  includeBusiness?: boolean;
}

const BPS_SCALE = 10000n;
const FULL_SHARE_BPS = 10000;

const monthStart = (month: string) => parseISO(`${month}-01`);
const monthOf = (isoDate: string) => format(parseISO(isoDate), "yyyy-MM");

const spreadMonthsOf = (txn: FinanceTransaction) => Math.max(1, Math.trunc(txn.spreadMonths));
const shareBpsOf = (txn: FinanceTransaction) =>
  BigInt(txn.isHousehold ? txn.myShareBps : FULL_SHARE_BPS);

/** Money out is negative on the row; every derived spend figure is a positive magnitude. */
const borneCents = (txn: FinanceTransaction) => BigInt(-txn.amountCents);

/**
 * Non-internal rows on accounts that count towards the owner's personal figures. Partner-paid
 * rows carry no account, so they are always in.
 */
function selectCountedRows(book: FinanceBook, options: FinanceQueryOptions): FinanceTransaction[] {
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
const isInMonth = (txn: FinanceTransaction, month: string) => monthOf(txn.txnDate) === month;

/** A row is recognised in the `spreadMonths` months beginning at its own month. */
function isRecognisedIn(txn: FinanceTransaction, month: string): boolean {
  const offset = differenceInCalendarMonths(monthStart(month), monthStart(monthOf(txn.txnDate)));
  return offset >= 0 && offset < spreadMonthsOf(txn);
}

function sumBorneSpend(
  book: FinanceBook,
  month: string,
  categoryId: string,
  options: FinanceQueryOptions,
): CentsFraction {
  if (!isCategoryOfKind(book, categoryId, "spend")) return ZERO_CENTS;
  let total = ZERO_CENTS;
  for (const txn of selectCountedRows(book, options)) {
    if (txn.categoryId !== categoryId || !isRecognisedIn(txn, month)) continue;
    const term = makeCentsFraction(
      borneCents(txn) * shareBpsOf(txn),
      BPS_SCALE * BigInt(spreadMonthsOf(txn)),
    );
    total = addCentsFractions(total, term);
  }
  return total;
}

/**
 * The budget number: what the owner actually bears in a category that month, at their share,
 * amortized across `spreadMonths`. Money-in rows in the category (refunds, rebates) net against
 * it. Amortization is a budget lens only — it never moves cash flow or settlement.
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
  for (const txn of selectCountedRows(book, options)) {
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
  for (const txn of selectCountedRows(book, options)) {
    if (txn.payer !== "me" || txn.amountCents <= 0 || !isInMonth(txn, month)) continue;
    if (!isCategoryOfKind(book, txn.categoryId, "income")) continue;
    total += txn.amountCents;
  }
  return total;
}

const selectHouseholdRows = (book: FinanceBook, month: string, options: FinanceQueryOptions) =>
  selectCountedRows(book, options).filter((txn) => txn.isHousehold && isInMonth(txn, month));

function sumTrueShare(rows: FinanceTransaction[]): CentsFraction {
  let total = ZERO_CENTS;
  for (const txn of rows) {
    total = addCentsFractions(
      total,
      makeCentsFraction(borneCents(txn) * BigInt(txn.myShareBps), BPS_SCALE),
    );
  }
  return total;
}

/** Every household row that month, either payer, at full amount — settlement never spreads. */
export function computeHouseholdTotal(
  book: FinanceBook,
  month: string,
  options: FinanceQueryOptions = {},
): number {
  let total = 0;
  for (const txn of selectHouseholdRows(book, month, options)) total -= txn.amountCents;
  return total;
}

/** The owner's own share of the household month, whoever paid. */
export function computeMyTrueShare(
  book: FinanceBook,
  month: string,
  options: FinanceQueryOptions = {},
): number {
  return roundToCents(sumTrueShare(selectHouseholdRows(book, month, options)));
}

/**
 * What the partner owes the owner: what the owner laid out for the household, less the owner's
 * own share, plus anything carried in, less what has already been paid. Negative means the owner
 * owes the partner — a real case, not a guard.
 */
export function computeSettlementBalance(
  book: FinanceBook,
  month: string,
  options: FinanceQueryOptions = {},
): number {
  const rows = selectHouseholdRows(book, month, options);
  let ownerPaid = 0;
  for (const txn of rows) if (txn.payer === "me") ownerPaid -= txn.amountCents;
  const settlement = book.financeSettlements.find((entry) => entry.month === month);
  const carried = settlement?.carriedDeltaCents ?? 0;
  const paid = settlement?.paidCents ?? 0;
  return roundToCents(
    subtractCentsFractions(fromCents(ownerPaid + carried - paid), sumTrueShare(rows)),
  );
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
