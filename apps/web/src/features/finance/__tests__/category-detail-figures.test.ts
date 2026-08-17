import { describe, expect, it } from "vitest";
import {
  computeCategoryCaptionFigures,
  computeCategoryMonthlySeries,
  computeMerchantConcentration,
  computeTrailingCompletedAverage,
} from "../category-detail-figures";
import { budget, GROCERIES, makeBook, row } from "./fixtures";

const MONTH = "2026-03";
const MID_MONTH = new Date(2026, 2, 15);

describe("the category's monthly series", () => {
  const book = makeBook({
    financeBudgets: [budget(GROCERIES, "2026-01", 57500), budget(GROCERIES, "2026-03", 50000)],
    financeTransactions: [
      row("2026-01-05", -30000),
      row("2026-02-05", -70000),
      row("2026-03-05", -20000),
    ],
  });

  it("judges each month against the budget it was actually judged against", () => {
    const section = computeCategoryMonthlySeries(
      book,
      GROCERIES,
      ["2026-01", "2026-02"],
      MID_MONTH,
    );
    if (section.status === "failed") throw new Error("expected the series to derive");
    expect(section.figures).toEqual([
      { month: "2026-01", spentCents: 30000, budgetCents: 57500, flag: "under" },
      { month: "2026-02", spentCents: 70000, budgetCents: 57500, flag: "over" },
    ]);
  });

  it("flags the month the clock is inside as current-partial rather than over or under", () => {
    const section = computeCategoryMonthlySeries(book, GROCERIES, [MONTH], MID_MONTH);
    if (section.status === "failed") throw new Error("expected the series to derive");
    expect(section.figures).toEqual([
      { month: MONTH, spentCents: 20000, budgetCents: 50000, flag: "current-partial" },
    ]);
  });

  it("reports a failure instead of throwing when a row's date is unreadable", () => {
    const broken = makeBook({ financeTransactions: [row("not-a-date", -1000)] });
    expect(computeCategoryMonthlySeries(broken, GROCERIES, [MONTH], MID_MONTH)).toEqual({
      status: "failed",
    });
  });
});

describe("the trailing completed-month average", () => {
  it("averages the three months before the given one, a quiet completed month counting as zero", () => {
    const book = makeBook({
      financeTransactions: [
        row("2025-12-05", -35000),
        // 2026-01 has no rows at all — a completed month with nothing spent still counts.
        row("2026-02-05", -55000),
      ],
    });
    // (35000 + 0 + 55000) / 3 = 30000.
    const section = computeTrailingCompletedAverage(book, GROCERIES, MONTH, 3);
    if (section.status === "failed") throw new Error("expected the average to derive");
    expect(section.figures).toBe(30000);
  });

  it("excludes the in-progress month itself from the average", () => {
    const book = makeBook({ financeTransactions: [row("2026-03-05", -900000)] });
    const section = computeTrailingCompletedAverage(book, GROCERIES, MONTH, 3);
    if (section.status === "failed") throw new Error("expected the average to derive");
    expect(section.figures).toBe(0);
  });
});

describe("merchant concentration", () => {
  it("sorts merchants descending and collapses the tail into one row", () => {
    const book = makeBook({
      financeTransactions: [
        row("2026-03-01", -7840, { merchantId: "noodle-house" }),
        row("2026-03-02", -5010, { merchantId: "dockside-grill" }),
        row("2026-03-03", -3220, { description: "CORNER BAKERY ANYTOWN ON" }),
        row("2026-03-04", -1860, { description: "BEAN STREET" }),
        row("2026-03-05", -900, { description: "CORNER STORE" }),
        row("2026-03-06", -800, { description: "CORNER STORE" }),
      ],
    });
    const section = computeMerchantConcentration(book, GROCERIES, MONTH, 4);
    if (section.status === "failed") throw new Error("expected concentration to derive");
    const { entries, othersCount, othersCents } = section.figures;
    expect(entries).toEqual([
      { key: "noodle-house", cents: 7840 },
      { key: "dockside-grill", cents: 5010 },
      { key: "CORNER BAKERY", cents: 3220 },
      { key: "BEAN STREET", cents: 1860 },
    ]);
    expect(othersCount).toBe(1);
    expect(othersCents).toBe(1700);
    const total = entries.reduce((sum, entry) => sum + entry.cents, 0) + othersCents;
    expect(total).toBe(19630);
  });

  it("reads an empty month as no entries and no tail", () => {
    const section = computeMerchantConcentration(makeBook(), GROCERIES, MONTH, 4);
    if (section.status === "failed") throw new Error("expected concentration to derive");
    expect(section.figures).toEqual({ entries: [], othersCount: 0, othersCents: 0 });
  });
});

describe("the caption figures", () => {
  it("counts breaches and completed months, and averages off the same rounded bars", () => {
    const book = makeBook({
      financeBudgets: [budget(GROCERIES, "2026-01", 10000)],
      financeTransactions: [
        row("2026-01-05", -20000),
        row("2026-02-05", -5000),
        row("2026-03-05", -1000),
      ],
    });
    const section = computeCategoryCaptionFigures(
      book,
      GROCERIES,
      ["2026-01", "2026-02", MONTH],
      MID_MONTH,
    );
    if (section.status === "failed") throw new Error("expected the caption to derive");
    expect(section.figures).toEqual({ breachedCount: 1, completedCount: 2, averageCents: 12500 });
  });
});
