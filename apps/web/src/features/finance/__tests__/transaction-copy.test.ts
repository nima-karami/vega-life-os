import type { FinanceImportBatch } from "@vega/shared";
import { describe, expect, it } from "vitest";
import {
  describeSaveState,
  describeShareLine,
  describeSpreadPreview,
  describeTransactionProvenance,
} from "../transaction-copy";
import { describeSpreadRecognition } from "../transaction-detail-figures";
import { row } from "./fixtures";

const batch = (patch: Partial<FinanceImportBatch> = {}): FinanceImportBatch => ({
  id: "fbat_1",
  status: "committed",
  fileNames: ["statement-a.csv"],
  fileHashes: [],
  accountId: "acc",
  detectedFormat: null,
  rowsParsed: 20,
  rowsInserted: 20,
  rowsSkipped: 0,
  startedAt: "2026-08-10T09:00:00.000Z",
  committedAt: "2026-08-10T09:00:00.000Z",
  writtenChunks: 1,
  updatedAt: "",
  fieldUpdatedAt: {},
  ...patch,
});

describe("the live share sentence", () => {
  it("names what the owner bears and what comes back when they paid", () => {
    const line = describeShareLine(-12999, 8000, "me", "2026-08-11", "Robin");
    expect(line.lead).toBe("You bear ");
    expect(line.bearing).toBe("$103.99");
    expect(line.tail).toBe(" · $26.00 comes back at the August settle-up.");
  });

  it("flips to what is owed when the partner paid, and uses their name", () => {
    const line = describeShareLine(-12999, 8000, "partner", "2026-08-11", "Robin");
    expect(line.bearing).toBe("$103.99");
    expect(line.tail).toBe(" · $26.00 goes to Robin at the August settle-up.");
  });

  it("falls back to the generic word when no partner name is set", () => {
    const line = describeShareLine(-12999, 8000, "partner", "2026-08-11", "  ");
    expect(line.tail).toContain("goes to Partner");
  });

  it("says nothing changes hands rather than printing a zero", () => {
    const line = describeShareLine(-5000, 10000, "me", "2026-08-11", "Robin");
    expect(line.tail).toBe(" · nothing changes hands at the August settle-up.");
  });
});

describe("the spread preview", () => {
  it("says nothing at all when the charge lands in one month", () => {
    expect(describeSpreadPreview(describeSpreadRecognition(row("2026-03-10", -12000)))).toBe("");
  });

  it("names the monthly figure and the remainder the first month carries", () => {
    const spread = row("2026-03-10", -100000, { spreadMonths: 12 });
    const preview = describeSpreadPreview(describeSpreadRecognition(spread));
    expect(preview).toContain("$83.33/mo across 12 months from March 2026");
    expect(preview).toContain("the first month carries $83.37");
    expect(preview).toContain("Cash still shows the full charge on its own date.");
  });

  it("drops the remainder clause when the split is even", () => {
    const spread = row("2026-03-10", -120000, { spreadMonths: 12 });
    expect(describeSpreadPreview(describeSpreadRecognition(spread))).toBe(
      "$100.00/mo across 12 months from March 2026. Cash still shows the full charge on its own date.",
    );
  });
});

describe("the provenance strip", () => {
  it("cites the file and the row an imported charge came from", () => {
    const imported = row("2026-08-09", -12999, {
      source: "import",
      importBatchId: "fbat_1",
      sourceRowNumber: 14,
    });
    const strip = describeTransactionProvenance(imported, [batch()], false);
    expect(strip.lead).toBe("From import");
    expect(strip.reference).toBe("statement-a.csv · row 14");
    expect(strip.trail).toBe("imported Aug 10 · part of the open August settle-up");
  });

  it("says an edit amends the month once that month is settled", () => {
    const imported = row("2026-08-09", -12999, { source: "import", importBatchId: "fbat_1" });
    const strip = describeTransactionProvenance(imported, [batch()], true);
    expect(strip.reference).toBe("statement-a.csv");
    expect(strip.trail).toContain(
      "part of the settled August settle-up, so an edit here amends that month",
    );
  });

  it("names who entered a hand-typed row instead of inventing a file", () => {
    const manual = row("2026-08-09", -12999, { source: "manual", enteredBy: "partner-reported" });
    const strip = describeTransactionProvenance(manual, [], false);
    expect(strip.lead).toBe("Added by hand");
    expect(strip.reference).toBe("");
    expect(strip.trail).toBe("partner-reported · part of the open August settle-up");
  });
});

describe("the autosave sub-line", () => {
  it("reports the three states the edit page can be in", () => {
    expect(describeSaveState(true, true)).toBe("Saving…");
    expect(describeSaveState(false, true)).toBe("Saved just now");
    expect(describeSaveState(false, false)).toBe("Every change saves itself.");
  });
});
