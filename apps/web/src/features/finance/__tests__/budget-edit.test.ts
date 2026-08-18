import { describe, expect, it } from "vitest";
import { resolveBudgetEdit } from "../budget-edit";
import { budget, GROCERIES } from "./fixtures";

const MONTH = "2026-03";

describe("committing the budget chip", () => {
  it("writes a row at the month on screen when the figure changes", () => {
    expect(resolveBudgetEdit("550", budget(GROCERIES, "2026-01", 50000), MONTH)).toEqual({
      kind: "set",
      cents: 55000,
    });
  });

  it("writes nothing when the typed figure is the one already in force", () => {
    expect(resolveBudgetEdit("$500.00", budget(GROCERIES, "2026-01", 50000), MONTH)).toEqual({
      kind: "unchanged",
    });
  });

  it("clears only a row written at this month — an inherited figure is cleared where it was set", () => {
    expect(resolveBudgetEdit("", budget(GROCERIES, MONTH, 50000), MONTH)).toEqual({
      kind: "clear",
      budgetId: `${GROCERIES}:${MONTH}`,
    });
    expect(resolveBudgetEdit("  ", budget(GROCERIES, "2026-01", 50000), MONTH)).toEqual({
      kind: "unchanged",
    });
  });

  it("refuses an unreadable or negative amount rather than writing a guess", () => {
    expect(resolveBudgetEdit("soon", null, MONTH)).toEqual({ kind: "invalid" });
    expect(resolveBudgetEdit("-40", null, MONTH)).toEqual({ kind: "invalid" });
  });

  it("sets a first budget on a category that never had one", () => {
    expect(resolveBudgetEdit("240.50", null, MONTH)).toEqual({ kind: "set", cents: 24050 });
  });
});
