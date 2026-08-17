import type {
  FinanceAccount,
  FinanceBudget,
  FinanceCategory,
  FinanceImportBatch,
  FinanceMerchant,
  FinanceSettlement,
  FinanceTransaction,
} from "@vega/shared";
import { addDays, format, startOfMonth, subMonths } from "date-fns";
import type { Dataset } from "../adapter";
import { iso } from "./helpers";

type FinanceSeed = Pick<
  Dataset,
  | "financeAccounts"
  | "financeCategories"
  | "financeBudgets"
  | "financeMerchants"
  | "financeImportBatches"
  | "financeTransactions"
  | "financeSettlements"
>;

const CHEQUING_ID = "facc_chequing";
const CARD_ID = "facc_card";
const GROCERIES_ID = "fcat_groceries";
const DINING_ID = "fcat_dining";
const HOME_ID = "fcat_home";
const SOFTWARE_ID = "fcat_software";
const INCOME_ID = "fcat_income";
const MARKET_ID = "fmer_market";
const BISTRO_ID = "fmer_bistro";
const TOOLWORKS_ID = "fmer_toolworks";
const CHEQUING_BATCH_ID = "fbat_chequing";
const CARD_BATCH_ID = "fbat_card";

const buildAccount = (
  id: string,
  slug: string,
  displayName: string,
  kind: FinanceAccount["kind"],
): FinanceAccount => ({
  id,
  slug,
  displayName,
  kind,
  isBusiness: false,
  columnMapping: null,
  archivedAt: null,
  updatedAt: "",
  fieldUpdatedAt: {},
});

const buildCategory = (
  id: string,
  name: string,
  kind: FinanceCategory["kind"],
  order: number,
): FinanceCategory => ({
  id,
  name,
  kind,
  order,
  colorIndex: order % 6,
  archivedAt: null,
  updatedAt: "",
  fieldUpdatedAt: {},
});

const buildBudget = (categoryId: string, month: string, cents: number): FinanceBudget => ({
  id: `${categoryId}:${month}`,
  categoryId,
  month,
  cents,
  updatedAt: "",
  fieldUpdatedAt: {},
});

const buildMerchant = (
  id: string,
  pattern: string,
  displayName: string,
  defaultCategoryId: string,
  counts: { timesSeen: number; timesShared: number; defaultSpreadMonths?: number },
  lastSeenAt: string,
): FinanceMerchant => ({
  id,
  pattern,
  displayName,
  defaultCategoryId,
  defaultSpreadMonths: counts.defaultSpreadMonths ?? 1,
  timesSeen: counts.timesSeen,
  timesShared: counts.timesShared,
  lastSeenAt,
  updatedAt: "",
  fieldUpdatedAt: {},
});

const buildImportBatch = (
  id: string,
  accountId: string,
  fileName: string,
  rows: { parsed: number; inserted: number; skipped: number },
  committedOn: string,
): FinanceImportBatch => ({
  id,
  status: "committed",
  fileNames: [fileName],
  fileHashes: [`demo-${id}`],
  accountId,
  detectedFormat: `demo-${accountId}-v1`,
  rowsParsed: rows.parsed,
  rowsInserted: rows.inserted,
  rowsSkipped: rows.skipped,
  startedAt: committedOn,
  committedAt: committedOn,
  writtenChunks: 1,
  updatedAt: "",
  fieldUpdatedAt: {},
});

const buildTransaction = (
  id: string,
  txnDate: string,
  description: string,
  amountCents: number,
  patch: Partial<FinanceTransaction> = {},
): FinanceTransaction => ({
  id,
  dedupeKey: null,
  accountId: CHEQUING_ID,
  txnDate,
  spreadMonths: 1,
  title: "",
  description,
  amountCents,
  currency: "CAD",
  originalAmountCents: null,
  originalCurrency: null,
  categoryId: null,
  merchantId: null,
  payer: "me",
  isHousehold: false,
  myShareBps: 10000,
  isInternal: false,
  source: "import",
  enteredBy: "me",
  importBatchId: CHEQUING_BATCH_ID,
  sourceRowNumber: null,
  refundOfTransactionId: null,
  reviewFlags: [],
  resolvedFlags: [],
  note: "",
  createdAt: txnDate,
  updatedAt: "",
  fieldUpdatedAt: {},
  ...patch,
});

const buildSettlement = (
  month: string,
  status: FinanceSettlement["status"],
  patch: Partial<FinanceSettlement> = {},
): FinanceSettlement => ({
  id: month,
  month,
  status,
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

/**
 * Synthetic sandbox data only — real financial data never enters the repo. Anchored
 * to `referenceDate` so the demo never rots: the month two back is settled, everything since is
 * open. Deliberately covers the shapes the finance screens have to render — a
 * partner-paid row, an internal-transfer pair, an unknown merchant awaiting review, a
 * 50/50 household split, and an annual charge spread over twelve months.
 */
export function buildFinance(referenceDate: Date): FinanceSeed {
  const settledStart = startOfMonth(subMonths(referenceDate, 2));
  const settledMonth = format(settledStart, "yyyy-MM");
  const openMonth = format(subMonths(referenceDate, 1), "yyyy-MM");
  const currentMonth = format(referenceDate, "yyyy-MM");
  const importedOn = iso(addDays(referenceDate, -2));

  const transactions = [
    buildTransaction("ftxn_rent", iso(addDays(settledStart, 1)), "PROPERTY MGMT — RENT", -200000, {
      dedupeKey: "7f3a1c02d4e59b60:0",
      title: "Rent",
      categoryId: HOME_ID,
      isHousehold: true,
      myShareBps: 5000,
      sourceRowNumber: 1,
    }),
    buildTransaction(
      "ftxn_market_settled",
      iso(addDays(settledStart, 6)),
      "GREEN MARKET #114",
      -14250,
      {
        dedupeKey: "b18e57ac902f4d31:0",
        title: "Groceries run",
        categoryId: GROCERIES_ID,
        merchantId: MARKET_ID,
        isHousehold: true,
        myShareBps: 5000,
        sourceRowNumber: 2,
      },
    ),
    buildTransaction(
      "ftxn_bistro_settled",
      iso(addDays(settledStart, 12)),
      "Corner Bistro dinner",
      -8600,
      {
        accountId: null,
        title: "Dinner out",
        categoryId: DINING_ID,
        merchantId: BISTRO_ID,
        payer: "partner",
        isHousehold: true,
        myShareBps: 5000,
        source: "manual",
        enteredBy: "partner-reported",
        importBatchId: null,
        note: "Her card — split evenly",
      },
    ),
    buildTransaction(
      "ftxn_salary",
      iso(addDays(referenceDate, -25)),
      "PAYROLL DEPOSIT — ACMEWORKS",
      480000,
      {
        dedupeKey: "2c4419fd6a03e785:0",
        title: "Paycheque",
        categoryId: INCOME_ID,
        sourceRowNumber: 3,
      },
    ),
    buildTransaction(
      "ftxn_licence",
      iso(addDays(referenceDate, -20)),
      "TOOLWORKS LICENCE ANNUAL",
      -36000,
      {
        dedupeKey: "9ab6035ec71d4820:0",
        title: "Toolworks licence",
        accountId: CARD_ID,
        spreadMonths: 12,
        categoryId: SOFTWARE_ID,
        merchantId: TOOLWORKS_ID,
        importBatchId: CARD_BATCH_ID,
        sourceRowNumber: 1,
      },
    ),
    buildTransaction(
      "ftxn_transfer_out",
      iso(addDays(referenceDate, -9)),
      "TRANSFER TO REWARDS CARD",
      -50000,
      {
        dedupeKey: "5d720ea4cb18f396:0",
        title: "Card payment",
        isInternal: true,
        reviewFlags: ["auto-internal"],
        resolvedFlags: ["auto-internal"],
        sourceRowNumber: 4,
      },
    ),
    buildTransaction(
      "ftxn_transfer_in",
      iso(addDays(referenceDate, -8)),
      "PAYMENT RECEIVED — THANK YOU",
      50000,
      {
        dedupeKey: "e60c8b1379af245d:0",
        title: "Card payment received",
        accountId: CARD_ID,
        isInternal: true,
        importBatchId: CARD_BATCH_ID,
        reviewFlags: ["auto-internal"],
        resolvedFlags: ["auto-internal"],
        sourceRowNumber: 2,
      },
    ),
    buildTransaction(
      "ftxn_market_recent",
      iso(addDays(referenceDate, -12)),
      "GREEN MARKET #114",
      -9875,
      {
        dedupeKey: "3f812d0b6e5a97c4:0",
        title: "Groceries run",
        categoryId: GROCERIES_ID,
        merchantId: MARKET_ID,
        isHousehold: true,
        myShareBps: 5000,
        sourceRowNumber: 5,
      },
    ),
    // No stored no-category flag: it derives from `categoryId === null && !isInternal`.
    // Title deliberately blank — an unreviewed charge has no clean label yet.
    buildTransaction(
      "ftxn_unknown",
      iso(addDays(referenceDate, -5)),
      "SQ *8231 VENDOR 4417",
      -4499,
      {
        dedupeKey: "a057e93c2148bd6f:0",
        accountId: CARD_ID,
        importBatchId: CARD_BATCH_ID,
        sourceRowNumber: 3,
      },
    ),
    buildTransaction(
      "ftxn_market_partner",
      iso(addDays(referenceDate, -3)),
      "Green Market — her run",
      -11200,
      {
        accountId: null,
        title: "Groceries (her run)",
        categoryId: GROCERIES_ID,
        merchantId: MARKET_ID,
        payer: "partner",
        isHousehold: true,
        myShareBps: 5000,
        source: "manual",
        enteredBy: "partner-reported",
        importBatchId: null,
      },
    ),
  ];

  return {
    financeAccounts: [
      buildAccount(CHEQUING_ID, "demo-chequing", "Everyday chequing", "chequing"),
      buildAccount(CARD_ID, "demo-card", "Rewards card", "credit_card"),
    ],
    financeCategories: [
      buildCategory(GROCERIES_ID, "Groceries", "spend", 0),
      buildCategory(DINING_ID, "Dining out", "spend", 1),
      buildCategory(HOME_ID, "Home & rent", "spend", 2),
      buildCategory(SOFTWARE_ID, "Software", "spend", 3),
      buildCategory(INCOME_ID, "Salary", "income", 4),
    ],
    financeBudgets: [
      buildBudget(GROCERIES_ID, settledMonth, 50000),
      buildBudget(GROCERIES_ID, currentMonth, 55000),
      buildBudget(DINING_ID, settledMonth, 25000),
      buildBudget(HOME_ID, settledMonth, 200000),
      buildBudget(SOFTWARE_ID, settledMonth, 5000),
    ],
    financeMerchants: [
      buildMerchant(
        MARKET_ID,
        "GREEN MARKET",
        "Green Market",
        GROCERIES_ID,
        { timesSeen: 6, timesShared: 4 },
        iso(addDays(referenceDate, -3)),
      ),
      buildMerchant(
        BISTRO_ID,
        "CORNER BISTRO",
        "Corner Bistro",
        DINING_ID,
        { timesSeen: 3, timesShared: 1 },
        iso(addDays(settledStart, 12)),
      ),
      buildMerchant(
        TOOLWORKS_ID,
        "TOOLWORKS LICENCE",
        "Toolworks",
        SOFTWARE_ID,
        { timesSeen: 1, timesShared: 0, defaultSpreadMonths: 12 },
        iso(addDays(referenceDate, -20)),
      ),
    ],
    financeImportBatches: [
      buildImportBatch(
        CHEQUING_BATCH_ID,
        CHEQUING_ID,
        "demo-chequing.csv",
        { parsed: 5, inserted: 5, skipped: 0 },
        importedOn,
      ),
      buildImportBatch(
        CARD_BATCH_ID,
        CARD_ID,
        "demo-card.csv",
        { parsed: 4, inserted: 3, skipped: 1 },
        importedOn,
      ),
    ],
    financeTransactions: transactions,
    financeSettlements: [
      buildSettlement(settledMonth, "settled", {
        settledBalanceCents: 102825,
        settledAt: iso(addDays(settledStart, 33)),
        paidCents: 102825,
        paidAt: iso(addDays(settledStart, 34)),
      }),
      buildSettlement(openMonth, "open"),
    ],
  };
}
