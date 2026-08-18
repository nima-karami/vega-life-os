import { describe, expect, it } from "vitest";
import { buildCategoryTable, sumCategoryTotals } from "../category-table-figures";
import { BUSINESS, budget, GROCERIES, makeBook, row, SOFTWARE } from "./fixtures";

const MONTH = "2026-03";

const readRows = (book: Parameters<typeof buildCategoryTable>[0]) => {
  const table = buildCategoryTable(book, MONTH);
  if (table.status === "failed") throw new Error("expected the table to derive");
  return table.figures;
};

describe("the categories table", () => {
  it("carries the budget in force, the month's spend, and the trailing average per row", () => {
    const book = makeBook({
      financeBudgets: [budget(GROCERIES, "2026-01", 57500)],
      financeTransactions: [
        row("2025-12-05", -35000),
        row("2026-02-05", -55000),
        row("2026-03-05", -20000),
      ],
    });

    const groceries = readRows(book).rows.find((entry) => entry.id === GROCERIES);
    expect(groceries).toMatchObject({
      budgetCents: 57500,
      spentCents: 20000,
      rowCount: 1,
      spreadCount: 0,
      // (35000 + 0 + 55000) / 3 — the quiet January still counts, at zero.
      averageCents: 30000,
      isOverBudget: false,
    });
  });

  it("counts a spread row in every month it is recognised in, and says how many are spread", () => {
    const book = makeBook({
      financeTransactions: [
        row("2026-01-10", -120000, { spreadMonths: 12 }),
        row("2026-03-02", -500),
      ],
    });

    const groceries = readRows(book).rows.find((entry) => entry.id === GROCERIES);
    expect(groceries).toMatchObject({ rowCount: 2, spreadCount: 1, spentCents: 10500 });
  });

  it("never reads a category with no budget row in force as over, whatever it spent", () => {
    const book = makeBook({ financeTransactions: [row("2026-03-05", -1000)] });
    const groceries = readRows(book).rows.find((entry) => entry.id === GROCERIES);
    expect(groceries).toMatchObject({ budgetCents: null, isOverBudget: false });
  });

  it("still reads a category over against a budget row explicitly set to zero", () => {
    const book = makeBook({
      financeBudgets: [budget(GROCERIES, "2026-01", 0)],
      financeTransactions: [row("2026-03-05", -1000)],
    });
    const groceries = readRows(book).rows.find((entry) => entry.id === GROCERIES);
    expect(groceries).toMatchObject({ budgetCents: 0, isOverBudget: true });
  });

  it("states the uncategorised rows at their full charge, outside every category figure", () => {
    const book = makeBook({
      financeTransactions: [
        row("2026-03-04", -61240, { categoryId: null, isHousehold: true, myShareBps: 5000 }),
        row("2026-03-05", -1000),
        // A business row is outside the personal figures entirely, categorised or not.
        row("2026-03-06", -9999, { categoryId: null, accountId: BUSINESS }),
      ],
    });

    expect(readRows(book).uncategorised).toEqual({ rowCount: 1, chargedCents: 61240 });
  });

  it("reports a failure rather than throwing when a row's date is unreadable", () => {
    const broken = makeBook({ financeTransactions: [row("not-a-date", -1000)] });
    expect(buildCategoryTable(broken, MONTH)).toEqual({ status: "failed" });
  });
});

describe("the table totals", () => {
  it("sums the spend rows only, so an income category never lands in a budget total", () => {
    const book = makeBook({
      financeBudgets: [budget(GROCERIES, MONTH, 70000), budget(SOFTWARE, MONTH, 9000)],
      financeTransactions: [row("2026-01-05", -30000), row("2026-03-05", -20000)],
    });

    const { rows } = readRows(book);
    expect(sumCategoryTotals(rows)).toEqual({
      budgetCents: 79000,
      spentCents: 20000,
      averageCents: 10000,
    });
  });
});
