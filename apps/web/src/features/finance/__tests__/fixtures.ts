import type {
  FinanceAccount,
  FinanceBudget,
  FinanceCategory,
  FinanceSettlement,
  FinanceTransaction,
} from "@vega/shared";
import {
  computeBorneSpendByCategory,
  computeMonthSpend,
  type FinanceBook,
  type FinanceQueryOptions,
  resolveEffectiveBudgets,
} from "../queries";

/** The per-category figures, read one category at a time — the shape the assertions want. */
export const borneSpend = (
  book: FinanceBook,
  month: string,
  categoryId: string,
  options: FinanceQueryOptions = {},
): number => computeBorneSpendByCategory(book, month, options).get(categoryId) ?? 0;

export const projectedSpend = (
  book: FinanceBook,
  month: string,
  categoryId: string,
  asOf: Date,
  options: FinanceQueryOptions = {},
): number => computeMonthSpend(book, month, asOf, options).get(categoryId)?.projectedCents ?? 0;

export const effectiveBudget = (book: FinanceBook, categoryId: string, month: string) =>
  resolveEffectiveBudgets(book, month).get(categoryId) ?? null;

export const CHEQUING = "acc_chequing";
export const BUSINESS = "acc_business";
export const GROCERIES = "cat_groceries";
export const SOFTWARE = "cat_software";
export const SALARY = "cat_salary";

const account = (id: string, isBusiness: boolean): FinanceAccount => ({
  id,
  slug: id,
  displayName: id,
  kind: "chequing",
  isBusiness,
  columnMapping: null,
  archivedAt: null,
  updatedAt: "",
  fieldUpdatedAt: {},
});

const category = (id: string, kind: FinanceCategory["kind"], order: number): FinanceCategory => ({
  id,
  name: id,
  kind,
  order,
  colorIndex: null,
  archivedAt: null,
  updatedAt: "",
  fieldUpdatedAt: {},
});

export const budget = (categoryId: string, month: string, cents: number): FinanceBudget => ({
  id: `${categoryId}:${month}`,
  categoryId,
  month,
  cents,
  updatedAt: "",
  fieldUpdatedAt: {},
});

export const settlement = (
  month: string,
  patch: Partial<FinanceSettlement> = {},
): FinanceSettlement => ({
  id: month,
  month,
  status: "open",
  settledBalanceCents: null,
  settledAt: null,
  paidCents: null,
  paidAt: null,
  paymentTransactionId: null,
  carriedDeltaCents: 0,
  note: "",
  updatedAt: "",
  fieldUpdatedAt: {},
  ...patch,
});

let rowCounter = 0;

/** Only the fields a derived figure reads are ever interesting here; the rest are inert. */
export function row(
  txnDate: string,
  amountCents: number,
  patch: Partial<FinanceTransaction> = {},
): FinanceTransaction {
  rowCounter += 1;
  return {
    id: `ftxn_${rowCounter}`,
    txnDate,
    amountCents,
    accountId: CHEQUING,
    spreadMonths: 1,
    categoryId: GROCERIES,
    payer: "me",
    isHousehold: false,
    myShareBps: 10000,
    isInternal: false,
    dedupeKey: null,
    title: "",
    description: "synthetic",
    currency: "CAD",
    originalAmountCents: null,
    originalCurrency: null,
    merchantId: null,
    source: "manual",
    enteredBy: "me",
    importBatchId: null,
    sourceRowNumber: null,
    refundOfTransactionId: null,
    reviewFlags: [],
    resolvedFlags: [],
    note: "",
    createdAt: txnDate,
    updatedAt: "",
    fieldUpdatedAt: {},
    ...patch,
  };
}

export function makeBook(patch: Partial<FinanceBook> = {}): FinanceBook {
  return {
    financeAccounts: [account(CHEQUING, false), account(BUSINESS, true)],
    financeCategories: [
      category(GROCERIES, "spend", 0),
      category(SOFTWARE, "spend", 1),
      category(SALARY, "income", 2),
    ],
    financeBudgets: [],
    financeTransactions: [],
    financeSettlements: [],
    ...patch,
  };
}
