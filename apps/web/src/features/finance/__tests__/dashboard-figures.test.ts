import { describe, expect, it } from "vitest";
import {
  type BudgetedCategoryFigures,
  deriveCashFlow,
  deriveCategoryBreakdown,
  isOverBudget,
  isOverBudgetAtThisPace,
  isSpendOverBudget,
} from "../dashboard-figures";
import { BUSINESS, budget, GROCERIES, makeBook, row, SALARY, SOFTWARE } from "./fixtures";

const MONTH = "2026-03";
const MID_MONTH = new Date(2026, 2, 10);
const NEXT_MONTH = new Date(2026, 3, 10);

const base = makeBook();
const [groceries, software] = base.financeCategories;
const TRAVEL = "cat_travel";
const ARCHIVED = "cat_archived";
const QUIET = "cat_quiet";
const travel = { ...software, id: TRAVEL, name: "travel", order: 3 };
const archived = {
  ...groceries,
  id: ARCHIVED,
  name: "archived",
  order: 4,
  archivedAt: "2026-02-01",
};
const quiet = { ...software, id: QUIET, name: "quiet", order: 5 };

const bookWithMonth = () =>
  makeBook({
    financeCategories: [...base.financeCategories, travel, archived, quiet],
    financeBudgets: [budget(GROCERIES, "2026-01", 57500)],
    financeTransactions: [
      row("2026-03-05", 400000, { categoryId: SALARY }),
      row("2026-03-06", -12000),
      row("2026-03-07", -5000, { accountId: BUSINESS }),
      row("2026-03-09", -3000, { categoryId: SOFTWARE }),
      row("2026-03-11", -8000, { categoryId: TRAVEL }),
      row("2026-03-12", -99000, { categoryId: ARCHIVED }),
    ],
  });

describe("the cash strip", () => {
  it("nets the owner's own money in against their own money out", () => {
    const cash = deriveCashFlow(bookWithMonth(), MONTH);
    expect(cash).toEqual({
      status: "ok",
      figures: { inCents: 400000, outCents: 122000, netCents: 278000 },
    });
  });

  it("leaves business accounts out until the toggle asks for them", () => {
    const book = bookWithMonth();
    expect(deriveCashFlow(book, MONTH)).toMatchObject({ figures: { outCents: 122000 } });
    expect(deriveCashFlow(book, MONTH, { includeBusiness: true })).toMatchObject({
      figures: { outCents: 127000 },
    });
  });

  it("reads a month with nothing in it as three zeroes, not a failure", () => {
    expect(deriveCashFlow(bookWithMonth(), "2026-04")).toEqual({
      status: "ok",
      figures: { inCents: 0, outCents: 0, netCents: 0 },
    });
  });

  it("reports a failure instead of throwing when a row's date is unreadable", () => {
    const book = makeBook({
      financeTransactions: [row("not-a-date", 1000, { categoryId: SALARY })],
    });
    expect(deriveCashFlow(book, MONTH)).toEqual({ status: "failed" });
  });
});

describe("the category breakdown", () => {
  const breakdown = () => {
    const section = deriveCategoryBreakdown(bookWithMonth(), MONTH, MID_MONTH);
    if (section.status === "failed") throw new Error("expected the breakdown to derive");
    return section.figures;
  };

  it("puts a category with a budget in force against that budget", () => {
    expect(breakdown().budgeted).toEqual([
      {
        id: GROCERIES,
        name: GROCERIES,
        spentCents: 12000,
        budgetCents: 57500,
        projectedCents: 37200,
      },
    ]);
  });

  it("groups the categories spending with no budget below, biggest spend first", () => {
    expect(breakdown().untracked).toEqual([
      { id: TRAVEL, name: "travel", spentCents: 8000 },
      { id: SOFTWARE, name: SOFTWARE, spentCents: 3000 },
    ]);
  });

  it("leaves out a category with no budget that spent nothing this month", () => {
    expect(breakdown().untracked.map((entry) => entry.id)).not.toContain(QUIET);
  });

  it("shows neither an income category nor an archived one", () => {
    const { budgeted, untracked } = breakdown();
    const listed = [...budgeted, ...untracked].map((entry) => entry.id);
    expect(listed).not.toContain(SALARY);
    expect(listed).not.toContain(ARCHIVED);
  });

  it("only counts a business row as untracked spend once the toggle asks for it", () => {
    const book = makeBook({
      financeTransactions: [row("2026-03-06", -4200, { accountId: BUSINESS })],
    });
    expect(deriveCategoryBreakdown(book, MONTH, MID_MONTH)).toMatchObject({
      figures: { untracked: [] },
    });
    expect(
      deriveCategoryBreakdown(book, MONTH, MID_MONTH, { includeBusiness: true }),
    ).toMatchObject({ figures: { untracked: [{ id: GROCERIES, spentCents: 4200 }] } });
  });

  it("only estimates a month-end for the month the clock is in", () => {
    const section = deriveCategoryBreakdown(bookWithMonth(), MONTH, NEXT_MONTH);
    expect(section).toMatchObject({ figures: { budgeted: [{ projectedCents: null }] } });
  });

  it("carries the business toggle into the borne figures too", () => {
    const book = makeBook({
      financeBudgets: [budget(GROCERIES, "2026-01", 57500)],
      financeTransactions: [row("2026-03-06", -5000, { accountId: BUSINESS })],
    });
    expect(deriveCategoryBreakdown(book, MONTH, MID_MONTH)).toMatchObject({
      figures: { budgeted: [{ spentCents: 0 }] },
    });
    expect(
      deriveCategoryBreakdown(book, MONTH, MID_MONTH, { includeBusiness: true }),
    ).toMatchObject({ figures: { budgeted: [{ spentCents: 5000 }] } });
  });

  it("reports a failure instead of throwing when a row's date is unreadable", () => {
    const book = makeBook({ financeTransactions: [row("not-a-date", -1000)] });
    expect(deriveCategoryBreakdown(book, MONTH, MID_MONTH)).toEqual({ status: "failed" });
  });
});

describe("the over-budget verdicts", () => {
  const figures = (patch: Partial<BudgetedCategoryFigures>): BudgetedCategoryFigures => ({
    id: GROCERIES,
    name: "Groceries",
    spentCents: 0,
    budgetCents: 57500,
    projectedCents: null,
    ...patch,
  });

  it("calls it over only once the spend passes the budget", () => {
    expect(isOverBudget(figures({ spentCents: 57499 }))).toBe(false);
    expect(isOverBudget(figures({ spentCents: 57500 }))).toBe(false);
    expect(isOverBudget(figures({ spentCents: 57501 }))).toBe(true);
  });

  it("calls the pace over only when there is an estimate to judge it by", () => {
    expect(isOverBudgetAtThisPace(figures({ spentCents: 30000 }))).toBe(false);
    expect(isOverBudgetAtThisPace(figures({ spentCents: 30000, projectedCents: 90000 }))).toBe(
      true,
    );
    expect(isOverBudgetAtThisPace(figures({ spentCents: 30000, projectedCents: 57500 }))).toBe(
      false,
    );
  });

  it("never calls a category with no budget row in force over, whatever it spent", () => {
    expect(isSpendOverBudget(50000, null)).toBe(false);
    expect(isSpendOverBudget(50000, 0)).toBe(true);
    expect(isSpendOverBudget(50000, 57500)).toBe(false);
    expect(isSpendOverBudget(57501, 57500)).toBe(true);
  });
});
