import type {
  FinanceCategory,
  FinanceImportBatch,
  FinanceMerchant,
  FinanceSettlement,
  FinanceTransaction,
} from "@vega/shared";
import { describe, expect, it } from "vitest";
import {
  ANY,
  buildCategoryNames,
  DEFAULT_TRANSACTION_FILTERS,
  describeProvenance,
  isTransactionLocked,
  listSettledMonths,
  listTransactionMonths,
  NO_CATEGORY,
  queryFinanceTransactions,
  resolveTransactionTitle,
  selectIdRange,
  type TransactionFilters,
} from "../transactions-query";

const meta = { updatedAt: "", fieldUpdatedAt: {} };

const txn = (patch: Partial<FinanceTransaction> & { id: string }): FinanceTransaction => ({
  dedupeKey: null,
  accountId: "acct_a",
  txnDate: "2026-03-04",
  spreadMonths: 1,
  title: "",
  description: "",
  amountCents: -1000,
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
  importBatchId: null,
  sourceRowNumber: null,
  refundOfTransactionId: null,
  reviewFlags: [],
  resolvedFlags: [],
  note: "",
  createdAt: "2026-03-04",
  ...meta,
  ...patch,
});

const category = (id: string, name: string): FinanceCategory => ({
  id,
  name,
  kind: "spend",
  order: 0,
  colorIndex: null,
  archivedAt: null,
  ...meta,
});

const settlement = (month: string, status: FinanceSettlement["status"]): FinanceSettlement => ({
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
  ...meta,
});

const GROCERIES = category("cat_groceries", "Groceries");
const DINING = category("cat_dining", "Dining");
const CATEGORY_NAMES = buildCategoryNames([GROCERIES, DINING]);

const LEDGER = [
  txn({
    id: "t1",
    txnDate: "2026-03-04",
    description: "GREEN MARKET",
    amountCents: -4500,
    categoryId: GROCERIES.id,
  }),
  txn({
    id: "t2",
    txnDate: "2026-04-11",
    description: "CORNER BISTRO",
    amountCents: -8600,
    categoryId: DINING.id,
    payer: "partner",
    accountId: null,
    note: "her card",
  }),
  txn({
    id: "t3",
    txnDate: "2026-04-20",
    description: "SQ *8231 VENDOR",
    amountCents: -1299,
    reviewFlags: ["no-category"],
  }),
];

const withFilters = (patch: Partial<TransactionFilters>): TransactionFilters => ({
  ...DEFAULT_TRANSACTION_FILTERS,
  ...patch,
});

const runQuery = (filters: Partial<TransactionFilters>, ledger = LEDGER) =>
  queryFinanceTransactions(ledger, CATEGORY_NAMES, withFilters(filters), {
    column: "date",
    direction: "desc",
  }).map((row) => row.id);

describe("ledger filtering", () => {
  it("searches description and note, not just description", () => {
    expect(runQuery({ query: "bistro" })).toEqual(["t2"]);
    expect(runQuery({ query: "her card" })).toEqual(["t2"]);
    expect(runQuery({ query: "no-such-row" })).toEqual([]);
  });

  it("also searches title", () => {
    const titled = [txn({ id: "t5", title: "Dinner with Robin" })];
    expect(runQuery({ query: "dinner with robin" }, titled)).toEqual(["t5"]);
  });

  it("narrows on account, month, payer and category independently", () => {
    expect(runQuery({ accountId: "acct_a" })).toEqual(["t3", "t1"]);
    expect(runQuery({ month: "2026-04" })).toEqual(["t3", "t2"]);
    expect(runQuery({ payer: "partner" })).toEqual(["t2"]);
    expect(runQuery({ categoryId: GROCERIES.id })).toEqual(["t1"]);
  });

  it("selects rows carrying no category at all", () => {
    expect(runQuery({ categoryId: NO_CATEGORY })).toEqual(["t3"]);
  });

  it("splits the ledger on unresolved review flags", () => {
    expect(runQuery({ review: "flagged" })).toEqual(["t3"]);
    expect(runQuery({ review: "clear" })).toEqual(["t2", "t1"]);
  });

  it("treats a resolved flag as no longer needing review", () => {
    const resolved = [
      txn({
        id: "t4",
        categoryId: GROCERIES.id,
        reviewFlags: ["auto-internal"],
        resolvedFlags: ["auto-internal"],
      }),
    ];
    expect(runQuery({ review: "flagged" }, resolved)).toEqual([]);
  });

  it("returns every row when nothing constrains it", () => {
    expect(runQuery({ accountId: ANY })).toHaveLength(3);
  });
});

describe("ledger sorting", () => {
  const sortedIds = (
    column: "date" | "amount" | "description" | "category",
    direction: "asc" | "desc",
  ) =>
    queryFinanceTransactions(LEDGER, CATEGORY_NAMES, DEFAULT_TRANSACTION_FILTERS, {
      column,
      direction,
    }).map((row) => row.id);

  it("sorts on date in both directions", () => {
    expect(sortedIds("date", "asc")).toEqual(["t1", "t2", "t3"]);
    expect(sortedIds("date", "desc")).toEqual(["t3", "t2", "t1"]);
  });

  it("sorts on signed amount, so the largest outflow is the smallest number", () => {
    expect(sortedIds("amount", "asc")).toEqual(["t2", "t1", "t3"]);
  });

  it("sorts on description and on category name", () => {
    expect(sortedIds("description", "asc")).toEqual(["t2", "t1", "t3"]);
    expect(sortedIds("category", "asc")).toEqual(["t3", "t2", "t1"]);
  });

  it("keeps a stable order for rows that tie", () => {
    const tied = [txn({ id: "b", txnDate: "2026-05-01" }), txn({ id: "a", txnDate: "2026-05-01" })];
    expect(
      queryFinanceTransactions(tied, CATEGORY_NAMES, DEFAULT_TRANSACTION_FILTERS, {
        column: "date",
        direction: "desc",
      }).map((row) => row.id),
    ).toEqual(["a", "b"]);
  });
});

describe("settled months", () => {
  const settlements = [settlement("2026-03", "settled"), settlement("2026-04", "open")];
  const settled = listSettledMonths(settlements);

  it("locks rows in a settled month", () => {
    expect(isTransactionLocked(LEDGER[0], settled)).toBe(true);
  });

  it("leaves rows in an open month editable", () => {
    expect(isTransactionLocked(LEDGER[1], settled)).toBe(false);
  });

  it("lists the months present, newest first", () => {
    expect(listTransactionMonths(LEDGER)).toEqual(["2026-04", "2026-03"]);
  });
});

describe("range selection", () => {
  const ordered = ["a", "b", "c", "d"];

  it("covers everything between the anchor and the target, either direction", () => {
    expect(selectIdRange(ordered, "b", "d")).toEqual(["b", "c", "d"]);
    expect(selectIdRange(ordered, "d", "b")).toEqual(["b", "c", "d"]);
  });

  it("falls back to the target alone when the anchor has scrolled out of the list", () => {
    expect(selectIdRange(ordered, "z", "c")).toEqual(["c"]);
  });
});

describe("provenance", () => {
  const batch: FinanceImportBatch = {
    id: "bat_1",
    status: "committed",
    fileNames: ["bank_card_jul.csv"],
    fileHashes: [],
    accountId: "acct_a",
    detectedFormat: null,
    rowsParsed: 0,
    rowsInserted: 0,
    rowsSkipped: 0,
    startedAt: "",
    committedAt: null,
    writtenChunks: 0,
    ...meta,
  };

  it("names the file and the row an imported transaction came from", () => {
    const imported = txn({ id: "t9", importBatchId: "bat_1", sourceRowNumber: 42 });
    expect(describeProvenance(imported, [batch])).toBe(
      "Imported from bank_card_jul.csv, row 42 · entered by you",
    );
  });

  it("distinguishes a row typed from the partner's message", () => {
    const manual = txn({ id: "t10", source: "manual", enteredBy: "partner-reported" });
    expect(describeProvenance(manual, [batch])).toBe("Added by hand · partner-reported");
  });
});

describe("resolveTransactionTitle", () => {
  const merchant: FinanceMerchant = {
    id: "fmer_market",
    pattern: "GREEN MARKET",
    displayName: "Green Market",
    defaultCategoryId: null,
    defaultSpreadMonths: 1,
    timesSeen: 1,
    timesShared: 0,
    lastSeenAt: null,
    ...meta,
  };

  it("prefers the row's own title", () => {
    const row = txn({ id: "t20", title: "Weekly groceries", description: "GREEN MARKET #114" });
    expect(resolveTransactionTitle(row, merchant)).toBe("Weekly groceries");
  });

  it("falls back to the merchant's display name when the row has no title", () => {
    const row = txn({ id: "t21", description: "GREEN MARKET #114" });
    expect(resolveTransactionTitle(row, merchant)).toBe("Green Market");
  });

  it("falls back to the raw description when neither title nor merchant is available", () => {
    const row = txn({ id: "t22", description: "SQ *8231 VENDOR 4417" });
    expect(resolveTransactionTitle(row)).toBe("SQ *8231 VENDOR 4417");
    expect(resolveTransactionTitle(row, null)).toBe("SQ *8231 VENDOR 4417");
  });
});
