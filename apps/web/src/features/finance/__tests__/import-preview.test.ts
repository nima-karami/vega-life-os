import type { FinanceCategory, FinanceImportBatch, FinanceMerchant } from "@vega/shared";
import { describe, expect, it } from "vitest";
import type { ParsedRow, ParsedStatement } from "../import/types";
import {
  buildImportOutcomeLenses,
  buildImportPreviewRows,
  buildRecentImports,
  countImportOutcomes,
  describePriorImport,
  describeStagedFile,
  describeWorkedExample,
  filterByImportLens,
  readImportOutcome,
} from "../import-preview";

const parsedRow = (patch: Partial<ParsedRow> = {}): ParsedRow => ({
  sourceRowNumber: 1,
  txnDate: "2026-08-09",
  description: "AMZN MKTP CA REF789",
  merchantPattern: "amzn mktp ca",
  amountCents: -12999,
  isInternal: false,
  dedupeKey: `key-${patch.sourceRowNumber ?? 1}-${patch.description ?? "AMZN"}`,
  isDuplicate: false,
  isKnownMerchant: false,
  reviewFlags: [],
  ...patch,
});

const statementOf = (rows: ParsedRow[]): ParsedStatement => ({
  file: "statement-a.csv",
  layoutId: null,
  mapping: {
    dateColumn: "Transaction Date",
    descriptionColumn: "Description",
    amountColumn: "Amount",
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
    internal: rows.filter((row) => row.isInternal).length,
    unknownMerchant: 0,
    nearDuplicate: 0,
  },
});

const category = (id: string, name: string, colorIndex: number): FinanceCategory => ({
  id,
  name,
  kind: "spend",
  order: colorIndex,
  colorIndex,
  archivedAt: null,
  updatedAt: "",
  fieldUpdatedAt: {},
});

const merchant = (pattern: string, defaultCategoryId: string | null): FinanceMerchant => ({
  id: `fmer_${pattern}`,
  pattern,
  displayName: pattern,
  defaultCategoryId,
  defaultSpreadMonths: 1,
  timesSeen: 3,
  timesShared: 0,
  lastSeenAt: null,
  updatedAt: "",
  fieldUpdatedAt: {},
});

const batch = (id: string, patch: Partial<FinanceImportBatch> = {}): FinanceImportBatch => ({
  id,
  status: "committed",
  fileNames: [`${id}.csv`],
  fileHashes: [id],
  accountId: "acc_card_a",
  detectedFormat: null,
  rowsParsed: 36,
  rowsInserted: 9,
  rowsSkipped: 0,
  startedAt: "2026-07-29T10:30:00.000Z",
  committedAt: "2026-07-29T10:30:30.000Z",
  writtenChunks: 1,
  updatedAt: "",
  fieldUpdatedAt: {},
  ...patch,
});

const MIXED = [
  parsedRow({ sourceRowNumber: 1, description: "AMZN" }),
  parsedRow({ sourceRowNumber: 2, description: "YUMI", merchantPattern: "yumi eats" }),
  parsedRow({ sourceRowNumber: 3, description: "METRO", isDuplicate: true }),
  parsedRow({
    sourceRowNumber: 4,
    description: "PAYMENT — THANK YOU",
    amountCents: 120000,
    isInternal: true,
  }),
];

describe("import outcomes", () => {
  it("reads a duplicate as already here even when it is also internal", () => {
    expect(readImportOutcome(parsedRow({ isDuplicate: true, isInternal: true }))).toBe(
      "already-here",
    );
  });

  it("counts New as everything a commit writes, internal rows included", () => {
    const counts = countImportOutcomes(MIXED);

    expect(counts).toEqual({ rowsRead: 4, newRows: 3, alreadyHere: 1, internal: 1 });
    // The chip and the accent button read the same figure, so the button can never overstate.
    expect(counts.newRows).toBe(statementOf(MIXED).counts.newRows);
  });

  it("partitions every row between the New and Already here lenses", () => {
    const rows = buildImportPreviewRows(statementOf(MIXED), [], []);
    const willAdd = filterByImportLens(rows, "will-add");
    const alreadyHere = filterByImportLens(rows, "already-here");

    expect(willAdd.length + alreadyHere.length).toBe(rows.length);
    expect(filterByImportLens(rows, "internal").map((row) => row.title)).toEqual([
      "PAYMENT — THANK YOU",
    ]);
  });

  it("labels the three lenses with the counts they filter on", () => {
    expect(buildImportOutcomeLenses(countImportOutcomes(MIXED))).toEqual([
      { outcome: "will-add", label: "New", count: 3 },
      { outcome: "already-here", label: "Already here", count: 1 },
      { outcome: "internal", label: "Internal", count: 1 },
    ]);
  });
});

describe("import preview rows", () => {
  it("carries the merchant table's category, with its palette colour", () => {
    const rows = buildImportPreviewRows(
      statementOf([parsedRow({ merchantPattern: "yumi eats" })]),
      [merchant("yumi eats", "cat_dining")],
      [category("cat_dining", "Dining out", 1)],
    );

    expect(rows[0].guess).toEqual({ name: "Dining out", color: "#B3854D" });
    expect(rows[0].dateLabel).toBe("Aug 9");
  });

  it("leaves the guess empty when the merchant is known but has no category yet", () => {
    const rows = buildImportPreviewRows(
      statementOf([parsedRow({ merchantPattern: "yumi eats" })]),
      [merchant("yumi eats", null)],
      [category("cat_dining", "Dining out", 1)],
    );

    expect(rows[0].guess).toBeNull();
  });

  it("has nothing to preview before a file is read", () => {
    expect(buildImportPreviewRows(null, [], [])).toEqual([]);
  });
});

describe("import copy", () => {
  it("states the file, what was read and what will land", () => {
    expect(describeStagedFile("statement-a.csv", countImportOutcomes(MIXED))).toBe(
      "statement-a.csv · 4 rows read, 3 new",
    );
  });

  it("says how the format was read, so a DD/MM misread is visible before it is written", () => {
    expect(
      describeWorkedExample({
        rawDate: "07/03/2026",
        txnDate: "2026-07-03",
        dateLabel: "3 July 2026 (MM/DD/YYYY)",
        rawAmount: "-12.50",
        amountCents: -1250,
        directionLabel: "money out",
      }),
    ).toContain("“07/03/2026” reads as 3 July 2026 (MM/DD/YYYY)");
  });

  it("states the missing format rather than guessing one", () => {
    expect(describeWorkedExample(null)).toContain("No row in this file");
  });
});

describe("recent imports", () => {
  it("reads newest first and keeps an all-duplicate import on the list", () => {
    const recent = buildRecentImports(
      [
        batch("statement-c", {
          committedAt: "2026-07-15T10:00:00.000Z",
          rowsInserted: 0,
        }),
        batch("statement-b"),
        batch("statement-d", { committedAt: "2026-07-22T10:00:00.000Z", rowsInserted: 18 }),
      ],
      6,
    );

    expect(recent.map((entry) => entry.fileName)).toEqual([
      "statement-b.csv",
      "statement-d.csv",
      "statement-c.csv",
    ]);
    expect(recent[0].when).toBe("Jul 29");
    expect(recent[2].added).toBe(0);
  });

  it("falls back to when the import started when it never committed", () => {
    const recent = buildRecentImports([batch("stalled", { committedAt: null })], 6);

    expect(recent[0].when).toBe("Jul 29");
  });
});

describe("the prior-import warning", () => {
  const PRIOR = batch("statement-b");

  it("says you already imported it when the same account took it", () => {
    expect(describePriorImport(PRIOR, "acc_card_a", "Card A")).toBe(
      "You already imported this exact file on 29 July 2026 — 9 rows landed then.",
    );
  });

  it("names the other account instead, so it never contradicts a count of new rows", () => {
    const note = describePriorImport(PRIOR, "acc_visa", "Rewards card");

    expect(note).toContain("Rewards card");
    expect(note, "the warning still claims the rows are already here").not.toContain(
      "already imported",
    );
  });

  it("says nothing when no earlier batch carried the file", () => {
    expect(describePriorImport(null, "acc_card_a", "Card A")).toBeUndefined();
  });
});
