import type { FinanceCategory } from "@vega/shared";
import { describe, expect, it } from "vitest";
import {
  FINANCE_CATEGORY_PALETTE,
  nextCategoryColorIndex,
  resolveCategoryColorIndex,
} from "../category-palette";

const category = (order: number, colorIndex: number | null = null): FinanceCategory => ({
  id: `fcat_${order}`,
  name: `Category ${order}`,
  kind: "spend",
  order,
  colorIndex,
  archivedAt: null,
  updatedAt: "",
  fieldUpdatedAt: {},
});

describe("FINANCE_CATEGORY_PALETTE", () => {
  it("has exactly six hexes", () => {
    expect(FINANCE_CATEGORY_PALETTE).toHaveLength(6);
  });
});

describe("resolveCategoryColorIndex", () => {
  it("uses the stored colorIndex when set", () => {
    expect(resolveCategoryColorIndex(category(0, 4))).toBe(4);
  });

  it("falls back to order modulo six when unset", () => {
    expect(resolveCategoryColorIndex(category(2))).toBe(2);
    expect(resolveCategoryColorIndex(category(7))).toBe(1);
  });

  it("guards a non-finite or negative order down to zero", () => {
    expect(resolveCategoryColorIndex(category(-3))).toBe(0);
    expect(resolveCategoryColorIndex(category(Number.NaN))).toBe(0);
  });
});

describe("the palette index stays in range", () => {
  it("lands inside the palette for any order the data carries", () => {
    for (const order of [0, 1, 5, 6, 41, 1000, -7]) {
      const index = resolveCategoryColorIndex(category(order));
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(FINANCE_CATEGORY_PALETTE.length);
    }
  });

  it("paints a hex from the palette however many categories exist", () => {
    for (let count = 0; count < 20; count += 1) {
      const existing = Array.from({ length: count }, (_, index) => category(index));
      const next = nextCategoryColorIndex(existing);
      expect(FINANCE_CATEGORY_PALETTE[next]).toBeDefined();
    }
  });
});

describe("nextCategoryColorIndex", () => {
  it("assigns the next slot in the palette by count", () => {
    expect(nextCategoryColorIndex([])).toBe(0);
    expect(nextCategoryColorIndex([category(0), category(1)])).toBe(2);
  });

  it("wraps around after six existing categories", () => {
    const existing = Array.from({ length: 6 }, (_, index) => category(index));
    expect(nextCategoryColorIndex(existing)).toBe(0);
    expect(nextCategoryColorIndex([...existing, category(6)])).toBe(1);
  });
});
