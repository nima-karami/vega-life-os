import type {
  FinanceCategory,
  FinanceImportBatch,
  FinanceSettlement,
  FinanceTransaction,
} from "@vega/shared";
import { describe, expect, it } from "vitest";
import {
  ANY,
  buildCategoryNames,
  DEFAULT_TRANSACTION_FILTERS,
  describeProvenance,
  formatShareBps,
  isTransactionLocked,
  listSettledMonths,
  listTransactionMonths,
  listUnresolvedFlags,
  NO_CATEGORY,
  parseShareBps,
  parseSpreadMonths,
  queryFinanceTransactions,
  selectIdRange,
  type TransactionFilters,
} from "../transactions-query";

const meta = { updatedAt: "", fieldUpdatedAt: {} };

const txn = (patch: Partial<FinanceTransaction> & { id: string }): FinanceTransaction => ({
  dedupeKey: null,
  accountId: "acct_a",
  txnDate: "2026-03-04",
  spreadMonths: 1,
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
    expect(listUnresolvedFlags(resolved[0])).toEqual([]);
    expect(runQuery({ review: "flagged" }, resolved)).toEqual([]);
  });

  it("returns every row when nothing constrains it", () => {
    expect(runQuery({ accountId: ANY })).toHaveLength(3);
  });
});

describe("no-category is derived, never stored", () => {
  it("raises the flag from an empty category, with nothing stored on the row", () => {
    expect(listUnresolvedFlags(txn({ id: "d1" }))).toEqual(["no-category"]);
  });

  it("drops the flag the moment a category is assigned, with no bookkeeping", () => {
    const stale = txn({ id: "d2", categoryId: GROCERIES.id, reviewFlags: ["no-category"] });
    expect(listUnresolvedFlags(stale)).toEqual([]);
  });

  it("never doubles a stored copy against the derived one", () => {
    const legacy = txn({ id: "d3", reviewFlags: ["no-category", "near-duplicate"] });
    expect(listUnresolvedFlags(legacy)).toEqual(["no-category", "near-duplicate"]);
  });

  it("exempts an internal transfer, which never earns a category", () => {
    const transfer = txn({ id: "d4", isInternal: true });
    expect(listUnresolvedFlags(transfer)).toEqual([]);
  });

  it("still surfaces an internal transfer while its auto-flag is unresolved", () => {
    const unconfirmed = txn({ id: "d5", isInternal: true, reviewFlags: ["auto-internal"] });
    expect(listUnresolvedFlags(unconfirmed)).toEqual(["auto-internal"]);
  });

  it("clears the internal transfer once the auto-flag is resolved", () => {
    const confirmed = txn({
      id: "d6",
      isInternal: true,
      reviewFlags: ["auto-internal"],
      resolvedFlags: ["auto-internal"],
    });
    expect(listUnresolvedFlags(confirmed)).toEqual([]);
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
  const settlements = [settlement("2026-03", "settled"), settlement("2026-04", "amended")];
  const settled = listSettledMonths(settlements);

  it("locks rows in a settled month", () => {
    expect(isTransactionLocked(LEDGER[0], settled)).toBe(true);
  });

  it("releases rows once the month is amended", () => {
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

describe("share and spread parsing", () => {
  it("takes any percentage, not just the presets", () => {
    expect(parseShareBps("50")).toBe(5000);
    expect(parseShareBps("37.25")).toBe(3725);
    expect(parseShareBps("0")).toBe(0);
    expect(parseShareBps("100")).toBe(10000);
  });

  it("refuses a figure that is not a share", () => {
    expect(parseShareBps("")).toBeNull();
    expect(parseShareBps("101")).toBeNull();
    expect(parseShareBps("-1")).toBeNull();
    expect(parseShareBps("half")).toBeNull();
  });

  it("round-trips basis points through the display string", () => {
    expect(formatShareBps(3725)).toBe("37.25");
    expect(formatShareBps(10000)).toBe("100");
    expect(parseShareBps(formatShareBps(3725))).toBe(3725);
  });

  it("keeps spread a whole number of months inside the allowed range", () => {
    expect(parseSpreadMonths("12")).toBe(12);
    expect(parseSpreadMonths("1")).toBe(1);
    expect(parseSpreadMonths("0")).toBeNull();
    expect(parseSpreadMonths("37")).toBeNull();
    expect(parseSpreadMonths("1.5")).toBeNull();
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
