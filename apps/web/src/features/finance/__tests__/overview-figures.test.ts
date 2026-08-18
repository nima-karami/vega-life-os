import { describe, expect, it } from "vitest";
import { computeCategoryBreachDays } from "../dashboard-charts";
import {
  buildTrendWindow,
  findDriftCategory,
  listMonthsEndingAt,
  rankTrendCategories,
  selectTrendSamples,
} from "../overview/overview-figures";
import { budget, GROCERIES, makeBook, row, SOFTWARE } from "./fixtures";

const MONTHS = ["2026-01", "2026-02", "2026-03"];

describe("listMonthsEndingAt", () => {
  it("walks back from the scoped month, oldest first", () => {
    expect(listMonthsEndingAt("2026-03", 3)).toEqual(MONTHS);
    expect(listMonthsEndingAt("2026-01", 2)).toEqual(["2025-12", "2026-01"]);
  });
});

describe("the trend window", () => {
  const book = makeBook({
    financeBudgets: [budget(GROCERIES, "2026-01", 57500), budget(GROCERIES, "2026-03", 70000)],
    financeTransactions: [
      row("2026-01-10", -80000),
      row("2026-02-10", -30000),
      row("2026-03-10", -24010),
      row("2026-02-10", -3000, { categoryId: SOFTWARE }),
    ],
  });

  it("carries the budget in force for each month, sparse rows resolved forward", () => {
    const samples = selectTrendSamples(buildTrendWindow(book, MONTHS), GROCERIES, "2026-03");
    expect(samples.map((entry) => entry.budgetCents)).toEqual([57500, 57500, 70000]);
    expect(samples.map((entry) => entry.cents)).toEqual([80000, 30000, 24010]);
  });

  it("marks the months at or past the open one as still running", () => {
    const samples = selectTrendSamples(buildTrendWindow(book, MONTHS), GROCERIES, "2026-03");
    expect(samples.map((entry) => entry.isOpen)).toEqual([false, false, true]);
  });

  it("reads zero for a category with nothing in a month rather than dropping the point", () => {
    const samples = selectTrendSamples(buildTrendWindow(book, MONTHS), SOFTWARE, "2026-03");
    expect(samples.map((entry) => entry.cents)).toEqual([0, 3000, 0]);
  });

  it("ranks the chips by spend but lists them in palette order", () => {
    const chips = rankTrendCategories(buildTrendWindow(book, MONTHS), book.financeCategories, 4);
    expect(chips.map((category) => category.id)).toEqual([GROCERIES, SOFTWARE]);
  });

  it("leaves a category that never spent out of the chip row", () => {
    const quiet = makeBook({ financeTransactions: [row("2026-02-10", -3000)] });
    const chips = rankTrendCategories(buildTrendWindow(quiet, MONTHS), quiet.financeCategories, 4);
    expect(chips.map((category) => category.id)).toEqual([GROCERIES]);
  });
});

describe("computeCategoryBreachDays", () => {
  it("names the day the running total first passed the budget", () => {
    const book = makeBook({
      financeTransactions: [
        row("2026-03-02", -10000),
        row("2026-03-09", -9000),
        row("2026-03-20", -5000),
      ],
    });
    const days = computeCategoryBreachDays(book, "2026-03", new Map([[GROCERIES, 18000]]));
    expect(days.get(GROCERIES)).toBe(9);
  });

  it("leaves a category that never crossed, or has no budget, out of the map", () => {
    const book = makeBook({ financeTransactions: [row("2026-03-02", -10000)] });
    expect(computeCategoryBreachDays(book, "2026-03", new Map([[GROCERIES, 18000]])).size).toBe(0);
    expect(computeCategoryBreachDays(book, "2026-03", new Map()).size).toBe(0);
  });

  it("lands a spread month's slice on day one, where it is recognised", () => {
    const book = makeBook({
      financeTransactions: [row("2026-01-20", -30000, { spreadMonths: 3 })],
    });
    const days = computeCategoryBreachDays(book, "2026-03", new Map([[GROCERIES, 9000]]));
    expect(days.get(GROCERIES)).toBe(1);
  });
});

describe("findDriftCategory", () => {
  const figures = (name: string, budgetCents: number, projectedCents: number | null) => ({
    id: name,
    name,
    spentCents: 0,
    budgetCents,
    projectedCents,
  });

  it("names the widest positive gap between the run rate and the budget", () => {
    expect(
      findDriftCategory([
        figures("Groceries", 70000, 67700),
        figures("Dining out", 18000, 40000),
        figures("Transport", 16000, 21000),
      ]),
    ).toBe("Dining out");
  });

  it("names nobody when every category is tracking under, or nothing can be projected", () => {
    expect(findDriftCategory([figures("Groceries", 70000, 67700)])).toBeNull();
    expect(findDriftCategory([figures("Groceries", 100, null)])).toBeNull();
  });
});
