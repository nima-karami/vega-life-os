import type { FinanceColumnMapping } from "@vega/shared";
import { describe, expect, it } from "vitest";
import { NONE } from "@/core/ui";
import {
  buildMappingFromDraft,
  buildPreviewExample,
  createEmptyDraft,
  isDraftComplete,
  readDraftFromMapping,
} from "../import/mapper-draft";
import type { TableView } from "../import/types";

const PAIRED_MAPPING: FinanceColumnMapping = {
  dateColumn: "Date",
  descriptionColumn: "Description",
  amountColumn: null,
  debitColumn: "Debit",
  creditColumn: "Credit",
  dateFormat: "DD/MM/YYYY",
  debitsArePositive: true,
  hasHeaderRow: true,
};

const view: TableView = {
  headers: ["Date", "Description", "Debit", "Credit"],
  rows: [{ cells: ["07/10/2026", "PANTRYCO", "38.40", ""], line: 2 }],
  hasHeaderRow: true,
};

describe("createEmptyDraft", () => {
  it("leaves every optional column unset", () => {
    const draft = createEmptyDraft(true);
    expect(draft.hasHeaderRow).toBe(true);
    expect([draft.amountColumn, draft.debitColumn, draft.creditColumn]).toEqual([NONE, NONE, NONE]);
    expect(isDraftComplete(draft)).toBe(false);
  });
});

describe("readDraftFromMapping", () => {
  it("round-trips a mapping through the draft unchanged", () => {
    expect(buildMappingFromDraft(readDraftFromMapping(PAIRED_MAPPING))).toEqual(PAIRED_MAPPING);
  });

  it("reads a null column as the unset sentinel", () => {
    expect(readDraftFromMapping(PAIRED_MAPPING).amountColumn).toBe(NONE);
  });

  it("falls back to MM/DD/YYYY when the stored format is not one we accept", () => {
    const draft = readDraftFromMapping({ ...PAIRED_MAPPING, dateFormat: "DD.MM.YY" });
    expect(draft.dateFormat).toBe("MM/DD/YYYY");
  });
});

describe("isDraftComplete", () => {
  it("accepts a debit column standing in for an amount column", () => {
    expect(isDraftComplete(readDraftFromMapping(PAIRED_MAPPING))).toBe(true);
  });

  it("rejects a draft naming neither an amount nor a debit column", () => {
    const draft = { ...readDraftFromMapping(PAIRED_MAPPING), debitColumn: NONE };
    expect(isDraftComplete(draft)).toBe(false);
  });
});

describe("buildPreviewExample", () => {
  it("reads the first row through the draft, debits positive", () => {
    const example = buildPreviewExample(readDraftFromMapping(PAIRED_MAPPING), view);
    expect(example).toMatchObject({
      rawDate: "07/10/2026",
      txnDate: "2026-10-07",
      rawAmount: "38.40",
      amountCents: -3840,
      directionLabel: "money out",
    });
  });

  it("returns null while the draft names no readable date", () => {
    const draft = { ...readDraftFromMapping(PAIRED_MAPPING), dateColumn: "Missing" };
    expect(buildPreviewExample(draft, view)).toBeNull();
  });
});
