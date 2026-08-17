import { describe, expect, it } from "vitest";
import {
  computeBorneSpendSeries,
  computeCumulativeBurn,
  computeStackedMonthlySeries,
} from "../dashboard-charts";
import { budget, GROCERIES, makeBook, row, SOFTWARE } from "./fixtures";

const MONTH = "2026-03";
const MONTHS = ["2026-01", "2026-02", "2026-03"];

describe("the borne spend series", () => {
  it("matches a single-month read for every requested month, in one pass", () => {
    const book = makeBook({
      financeTransactions: [
        row("2026-01-10", -5000),
        row("2026-02-10", -3000, { categoryId: SOFTWARE }),
        row("2026-03-10", -7000),
      ],
    });
    const series = computeBorneSpendSeries(book, MONTHS);
    expect(series.get("2026-01")?.get(GROCERIES)).toBe(5000);
    expect(series.get("2026-02")?.get(SOFTWARE)).toBe(3000);
    expect(series.get("2026-03")?.get(GROCERIES)).toBe(7000);
    expect(series.get("2026-02")?.get(GROCERIES)).toBeUndefined();
  });

  it("spreads a row's slice across every month it recognises, business excluded by default", () => {
    const book = makeBook({
      financeTransactions: [row("2026-01-10", -3000, { spreadMonths: 3 })],
    });
    const series = computeBorneSpendSeries(book, MONTHS);
    expect(series.get("2026-01")?.get(GROCERIES)).toBe(1000);
    expect(series.get("2026-02")?.get(GROCERIES)).toBe(1000);
    expect(series.get("2026-03")?.get(GROCERIES)).toBe(1000);
  });
});

describe("the cumulative burn", () => {
  const book = makeBook({
    financeBudgets: [budget(GROCERIES, "2026-01", 57500)],
    financeTransactions: [
      row("2026-03-01", -10000),
      row("2026-03-03", -5000),
      row("2026-03-10", -2500),
    ],
  });

  it("runs the day-by-day total through today, and stops there", () => {
    const section = computeCumulativeBurn(book, MONTH, new Date(2026, 2, 3));
    if (section.status === "failed") throw new Error("expected the burn to derive");
    const { cumulativeCents } = section.figures;
    expect(cumulativeCents).toEqual([
      { day: 1, cents: 10000 },
      { day: 2, cents: 10000 },
      { day: 3, cents: 15000 },
    ]);
  });

  it("carries the whole budget total as the plan-line endpoint", () => {
    const section = computeCumulativeBurn(book, MONTH, new Date(2026, 2, 3));
    if (section.status === "failed") throw new Error("expected the burn to derive");
    expect(section.figures.planEndCents).toBe(57500);
  });

  it("marks today as the elapsed fraction of the month", () => {
    const section = computeCumulativeBurn(book, MONTH, new Date(2026, 2, 10));
    if (section.status === "failed") throw new Error("expected the burn to derive");
    expect(section.figures.todayFraction).toBeCloseTo(10 / 31, 10);
  });

  it("labels a naive run-rate projection to month end", () => {
    const section = computeCumulativeBurn(book, MONTH, new Date(2026, 2, 10));
    if (section.status === "failed") throw new Error("expected the burn to derive");
    // 17500 through day 10 of 31 → 17500 × 31 / 10 = 54250.
    expect(section.figures.projectedCents).toBe(54250);
  });

  it("puts a later spread instalment's slice on day one of its recognised month", () => {
    const spread = makeBook({
      financeTransactions: [row("2026-01-15", -3000, { spreadMonths: 3 })],
    });
    const section = computeCumulativeBurn(spread, MONTH, new Date(2026, 2, 5));
    if (section.status === "failed") throw new Error("expected the burn to derive");
    expect(section.figures.cumulativeCents[0]).toEqual({ day: 1, cents: 1000 });
  });

  it("reports a failure instead of throwing when a row's date is unreadable", () => {
    const broken = makeBook({ financeTransactions: [row("not-a-date", -1000)] });
    expect(computeCumulativeBurn(broken, MONTH, new Date(2026, 2, 3))).toEqual({
      status: "failed",
    });
  });
});

describe("the stacked monthly series", () => {
  it("keeps segments and the column total in agreement, category order stable across months", () => {
    const book = makeBook({
      financeTransactions: [
        row("2026-03-05", -40000),
        row("2026-03-06", -10000, { categoryId: SOFTWARE }),
      ],
    });
    const section = computeStackedMonthlySeries(book, [MONTH], 6);
    if (section.status === "failed") throw new Error("expected the series to derive");
    const [column] = section.figures;
    expect(column.total).toBe(50000);
    expect(column.segments.reduce((sum, entry) => sum + entry.cents, 0)).toBe(column.total);
    expect(column.segments.map((entry) => entry.categoryId)).toEqual([GROCERIES, SOFTWARE]);
  });

  it("omits a category with zero spend that month rather than a zero segment", () => {
    const book = makeBook({ financeTransactions: [row("2026-03-05", -1000)] });
    const section = computeStackedMonthlySeries(book, [MONTH], 6);
    if (section.status === "failed") throw new Error("expected the series to derive");
    expect(section.figures[0].segments.map((entry) => entry.categoryId)).toEqual([GROCERIES]);
  });

  it("caps segments at the top N categories by total spend across the window", () => {
    const book = makeBook({
      financeTransactions: [
        row("2026-03-05", -40000),
        row("2026-03-06", -10000, { categoryId: SOFTWARE }),
      ],
    });
    const section = computeStackedMonthlySeries(book, [MONTH], 1);
    if (section.status === "failed") throw new Error("expected the series to derive");
    expect(section.figures[0].segments.map((entry) => entry.categoryId)).toEqual([GROCERIES]);
    expect(section.figures[0].total).toBe(40000);
  });
});
