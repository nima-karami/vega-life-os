import type { FinanceColumnMapping } from "@vega/shared";
import { describe, expect, it } from "vitest";
import { parseDelimitedTable } from "../import/delimited";
import { type ParseStatementInput, parseStatement } from "../import/parse";
import type { ParsedStatement } from "../import/types";

const signedMapping: FinanceColumnMapping = {
  dateColumn: "Date",
  descriptionColumn: "Description",
  amountColumn: "Amount",
  debitColumn: null,
  creditColumn: null,
  dateFormat: "DD/MM/YYYY",
  debitsArePositive: false,
  hasHeaderRow: true,
};

const SIGNED_CSV = [
  "Date,Description,Amount",
  '07/10/2026,"LANTERN, ANYTOWN ON",-38.40',
  "08/03/2026,PAYMENT - THANK YOU,120.00",
  "",
].join("\r\n");

const run = (overrides: Partial<ParseStatementInput> = {}) =>
  parseStatement({
    fileName: "bank_card_jul.csv",
    table: parseDelimitedTable(SIGNED_CSV),
    accountId: "acct-card",
    accountSlug: "cibc_mc",
    accountMapping: signedMapping,
    existingKeys: new Set(),
    knownMerchantPatterns: new Set(),
    existingTransactions: [],
    ...overrides,
  });

const expectParsed = async (
  overrides: Partial<ParseStatementInput> = {},
): Promise<ParsedStatement> => {
  const outcome = await run(overrides);
  if (outcome.status !== "parsed") throw new Error(`expected parsed, got ${outcome.status}`);
  return outcome.statement;
};

describe("parseStatement — date convention", () => {
  it("reads an ambiguous cell under the declared DD/MM convention", async () => {
    const statement = await expectParsed();
    expect(statement.rows[0].txnDate).toBe("2026-10-07");
  });

  it("reads the very same file differently under MM/DD, which is why it is confirmed", async () => {
    const statement = await expectParsed({
      accountMapping: { ...signedMapping, dateFormat: "MM/DD/YYYY" },
    });
    expect(statement.rows[0].txnDate).toBe("2026-07-10");
  });

  it("exposes a worked example the owner confirms before any write", async () => {
    const statement = await expectParsed({
      accountMapping: { ...signedMapping, dateFormat: "MM/DD/YYYY" },
    });
    expect(statement.workedExample).toEqual({
      rawDate: "07/10/2026",
      txnDate: "2026-07-10",
      dateLabel: "10 July 2026 (MM/DD/YYYY)",
      rawAmount: "-38.40",
      amountCents: -3840,
      directionLabel: "money out",
    });
  });
});

describe("parseStatement — sign convention", () => {
  it("takes a signed amount column as written", async () => {
    const statement = await expectParsed();
    expect(statement.rows.map((row) => row.amountCents)).toEqual([-3840, 12000]);
  });

  it("inverts a card export whose charges are written positive", async () => {
    const statement = await expectParsed({
      accountMapping: { ...signedMapping, debitsArePositive: true },
    });
    expect(statement.rows.map((row) => row.amountCents)).toEqual([3840, -12000]);
  });

  it("reads a debit/credit pair as magnitudes", async () => {
    const table = parseDelimitedTable(
      "Date,Description,Debit,Credit\n07/10/2026,PANTRYCO,38.40,\n08/03/2026,REFUND,,12.00\n",
    );
    const statement = await expectParsed({
      table,
      accountMapping: {
        ...signedMapping,
        amountColumn: null,
        debitColumn: "Debit",
        creditColumn: "Credit",
        debitsArePositive: true,
      },
    });
    expect(statement.rows.map((row) => row.amountCents)).toEqual([-3840, 1200]);
  });
});

describe("parseStatement — flags and counts", () => {
  it("flags an internal transfer without removing the row", async () => {
    const statement = await expectParsed();
    expect(statement.rows[1].isInternal).toBe(true);
    expect(statement.rows[1].reviewFlags).toEqual(["auto-internal"]);
    expect(statement.rows).toHaveLength(2);
    expect(statement.counts.internal).toBe(1);
  });

  it("keeps the raw description and puts the normalised form beside it", async () => {
    const statement = await expectParsed();
    expect(statement.rows[0].description).toBe("LANTERN, ANYTOWN ON");
    expect(statement.rows[0].merchantPattern).toBe("LANTERN");
  });

  it("counts merchants it has never seen", async () => {
    const statement = await expectParsed({ knownMerchantPatterns: new Set(["LANTERN"]) });
    expect(statement.counts.unknownMerchant).toBe(1);
    expect(statement.rows[0].isKnownMerchant).toBe(true);
  });

  it("reports overlapping rows as duplicates instead of dropping them", async () => {
    const first = await expectParsed();
    const stored = new Set(first.rows.map((row) => row.dedupeKey));
    const second = await expectParsed({ existingKeys: stored });
    expect(second.counts).toMatchObject({ parsed: 2, newRows: 0, duplicate: 2 });
    expect(second.rows[0].reviewFlags).toContain("possible-duplicate");
  });

  it("raises a near-duplicate against a posted row on the same account", async () => {
    const statement = await expectParsed({
      existingTransactions: [
        {
          id: "txn-pending",
          accountId: "acct-card",
          txnDate: "2026-10-08",
          amountCents: -4000,
          dedupeKey: "cccccccccccccccc:0",
        },
      ],
    });
    expect(statement.counts.nearDuplicate).toBe(1);
    expect(statement.rows[0].reviewFlags).toContain("near-duplicate");
    expect(statement.nearDuplicates[0].existingTransactionId).toBe("txn-pending");
  });

  it("records the source line of every row", async () => {
    const statement = await expectParsed();
    expect(statement.rows.map((row) => row.sourceRowNumber)).toEqual([2, 3]);
  });
});

describe("parseStatement — headerless files", () => {
  const DATA_ROWS = [
    '07/10/2026,"LANTERN, ANYTOWN ON",-38.40',
    "08/03/2026,PAYMENT - THANK YOU,120.00",
  ];
  const headerless: FinanceColumnMapping = {
    ...signedMapping,
    dateColumn: "Column 1",
    descriptionColumn: "Column 2",
    amountColumn: "Column 3",
    hasHeaderRow: false,
  };

  it("keeps the first transaction that a headered read would have eaten", async () => {
    const headered = await expectParsed();
    const bare = await expectParsed({
      table: parseDelimitedTable(`${DATA_ROWS.join("\r\n")}\r\n`),
      accountMapping: headerless,
    });
    expect(headered.rows).toHaveLength(DATA_ROWS.length);
    expect(bare.rows).toHaveLength(DATA_ROWS.length);
    expect(bare.rows[0].description).toBe("LANTERN, ANYTOWN ON");
    expect(bare.rows[0].sourceRowNumber).toBe(1);
  });

  it("parses a headered file identically whether or not the mapping is remembered", async () => {
    const remembered = await expectParsed();
    const detected = await expectParsed({ accountMapping: { ...signedMapping } });
    expect(detected.rows).toEqual(remembered.rows);
  });

  it("offers positional labels so an unmapped headerless file can still be mapped", async () => {
    const outcome = await run({
      table: parseDelimitedTable(`${DATA_ROWS.join("\r\n")}\r\n`),
      accountMapping: null,
    });
    expect(outcome).toMatchObject({
      status: "mapping-required",
      error: { headers: ["Column 1", "Column 2", "Column 3"] },
    });
  });
});

describe("parseStatement — failure shapes", () => {
  it("asks for a mapping instead of guessing an unknown layout", async () => {
    const outcome = await run({ accountMapping: null });
    expect(outcome).toEqual({
      status: "mapping-required",
      error: {
        code: "MAPPING_REQUIRED",
        file: "bank_card_jul.csv",
        headers: ["Date", "Description", "Amount"],
      },
    });
  });

  it("fails the file, naming the line, when a date does not match the declared format", async () => {
    const table = parseDelimitedTable(
      "Date,Description,Amount\n07/10/2026,A,-1.00\n31/31/2026,B,-2.00\n",
    );
    const outcome = await run({ table });
    expect(outcome).toEqual({
      status: "parse-failed",
      error: {
        code: "PARSE_FAILED",
        file: "bank_card_jul.csv",
        line: 3,
        reason: '"31/31/2026" is not a DD/MM/YYYY date',
      },
    });
  });

  it("fails when the mapping names a column the file does not have", async () => {
    const outcome = await run({
      accountMapping: { ...signedMapping, amountColumn: "CAD$", debitColumn: null },
    });
    expect(outcome.status).toBe("mapping-required");
  });

  it("rejects a mapping carrying a date format the importer does not support", async () => {
    const outcome = await run({ accountMapping: { ...signedMapping, dateFormat: "DD-MMM-YY" } });
    expect(outcome).toMatchObject({
      status: "parse-failed",
      error: { line: 1, reason: 'unsupported date format "DD-MMM-YY"' },
    });
  });
});
