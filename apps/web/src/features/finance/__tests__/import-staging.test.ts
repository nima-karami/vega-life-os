import type { FinanceMerchant } from "@vega/shared";
import { describe, expect, it } from "vitest";
import { MAX_IMPORT_BYTES, MAX_IMPORT_ROWS, type ParsedRow, type ParsedStatement } from "../import";
import {
  describeLimitBreach,
  findAccountMismatch,
  findLimitBreach,
  stageImport,
} from "../import-staging";

const parsedRow = (patch: Partial<ParsedRow> = {}): ParsedRow => ({
  sourceRowNumber: 1,
  txnDate: "2026-07-10",
  description: "GREEN MARKET #114",
  merchantPattern: "GREEN MARKET",
  amountCents: -3840,
  isInternal: false,
  dedupeKey: "aaaa1111bbbb2222:0",
  isDuplicate: false,
  isKnownMerchant: true,
  reviewFlags: [],
  ...patch,
});

const statement = (rows: ParsedRow[]): ParsedStatement => ({
  file: "july.csv",
  layoutId: "rbc-export",
  mapping: {
    dateColumn: "Transaction Date",
    descriptionColumn: "Description 1",
    amountColumn: "CAD$",
    debitColumn: null,
    creditColumn: null,
    dateFormat: "MM/DD/YYYY",
    debitsArePositive: false,
    hasHeaderRow: true,
  },
  workedExample: null,
  rows,
  nearDuplicates: [],
  counts: {
    parsed: rows.length,
    newRows: rows.filter((row) => !row.isDuplicate).length,
    duplicate: rows.filter((row) => row.isDuplicate).length,
    internal: 0,
    unknownMerchant: 0,
    nearDuplicate: 0,
  },
});

const merchant = (patch: Partial<FinanceMerchant> = {}): FinanceMerchant => ({
  id: "fmer_market",
  pattern: "GREEN MARKET",
  displayName: "Green Market",
  defaultCategoryId: "fcat_groceries",
  defaultSpreadMonths: 1,
  timesSeen: 4,
  timesShared: 2,
  lastSeenAt: "2026-06-30",
  updatedAt: "",
  fieldUpdatedAt: {},
  ...patch,
});

describe("import limits", () => {
  it("rejects a file over the byte ceiling and says which limit was hit", () => {
    const breach = findLimitBreach({ bytes: MAX_IMPORT_BYTES + 1 });
    expect(breach).toEqual({
      kind: "bytes",
      allowed: MAX_IMPORT_BYTES,
      actual: MAX_IMPORT_BYTES + 1,
    });
    expect(describeLimitBreach(breach as never)).toContain("20 MB");
  });

  it("rejects a file over the row ceiling", () => {
    expect(findLimitBreach({ rows: MAX_IMPORT_ROWS + 1 })?.kind).toBe("rows");
  });

  it("passes a file inside both ceilings", () => {
    expect(findLimitBreach({ bytes: MAX_IMPORT_BYTES, rows: MAX_IMPORT_ROWS })).toBeNull();
  });
});

describe("account mismatch", () => {
  const profile = new Set(["A", "B", "C", "D", "E"]);
  const strangers = Array.from({ length: 10 }, (_, index) =>
    parsedRow({ merchantPattern: `STRANGER ${index}`, dedupeKey: `k${index}:0` }),
  );

  it("warns when almost every merchant is a stranger to the account", () => {
    expect(findAccountMismatch(strangers, profile)).toEqual({ unmatched: 10, parsed: 10 });
  });

  it("stays quiet when the statement matches the account's profile", () => {
    const familiar = strangers.map((row, index) =>
      parsedRow({ ...row, merchantPattern: index < 8 ? "A" : row.merchantPattern }),
    );
    expect(findAccountMismatch(familiar, profile)).toBeNull();
  });

  it("cannot warn about an account with no profile yet", () => {
    expect(findAccountMismatch(strangers, new Set(["A"]))).toBeNull();
  });
});

describe("staging a statement", () => {
  const input = {
    accountId: "facc_chequing",
    batchId: "fbat_1",
    merchants: [merchant()],
  };

  it("drops duplicates, counts them, and keys a row by its dedupe key", () => {
    const staged = stageImport({
      ...input,
      statement: statement([
        parsedRow(),
        parsedRow({ dedupeKey: "aaaa1111bbbb2222:1", isDuplicate: true }),
      ]),
    });

    expect(staged.skipped).toBe(1);
    expect(staged.transactions).toHaveLength(1);
    expect(staged.transactions[0]).toMatchObject({
      id: "ftxn_aaaa1111bbbb2222:0",
      dedupeKey: "aaaa1111bbbb2222:0",
      accountId: "facc_chequing",
      importBatchId: "fbat_1",
      source: "import",
      enteredBy: "me",
      sourceRowNumber: 1,
    });
  });

  it("applies the merchant's remembered category and spread, and never a share", () => {
    const staged = stageImport({
      ...input,
      merchants: [merchant({ defaultSpreadMonths: 12 })],
      statement: statement([parsedRow()]),
    });

    expect(staged.transactions[0]).toMatchObject({
      categoryId: "fcat_groceries",
      merchantId: "fmer_market",
      spreadMonths: 12,
    });
    expect(staged.transactions[0]).not.toHaveProperty("myShareBps");
    expect(staged.transactions[0]).not.toHaveProperty("isHousehold");
  });

  it("leaves an unknown merchant uncategorised without stamping a no-category flag", () => {
    const staged = stageImport({
      ...input,
      merchants: [],
      statement: statement([parsedRow({ reviewFlags: ["auto-internal"] })]),
    });

    expect(staged.transactions[0].categoryId).toBeNull();
    expect(staged.transactions[0].merchantId).toBeNull();
    expect(staged.transactions[0].reviewFlags).toEqual(["auto-internal"]);
  });

  it("advances only merchants it already knows, and never moves lastSeenAt backwards", () => {
    const staged = stageImport({
      ...input,
      merchants: [merchant({ lastSeenAt: "2026-08-01" })],
      statement: statement([
        parsedRow(),
        parsedRow({ dedupeKey: "aaaa1111bbbb2222:1", txnDate: "2026-07-09" }),
        parsedRow({ merchantPattern: "NEW PLACE", dedupeKey: "cccc:0" }),
      ]),
    });

    expect(staged.merchants).toHaveLength(1);
    expect(staged.merchants[0]).toMatchObject({
      id: "fmer_market",
      timesSeen: 6,
      lastSeenAt: "2026-08-01",
    });
  });
});
