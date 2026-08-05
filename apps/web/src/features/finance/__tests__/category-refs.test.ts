import type { FinanceBudget, FinanceMerchant, FinanceTransaction } from "@vega/shared";
import { describe, expect, it } from "vitest";
import {
  type CategoryReferences,
  describeCategoryReferences,
  describeDroppedBudgets,
  indexCategoryReferences,
  isCategoryReferenced,
  NO_CATEGORY_REFERENCES,
  selectCategoryReferences,
} from "../category-refs";

const txn = (id: string, categoryId: string | null) =>
  ({ id, categoryId }) as unknown as FinanceTransaction;
const merchant = (id: string, defaultCategoryId: string | null) =>
  ({ id, defaultCategoryId }) as unknown as FinanceMerchant;
const budget = (id: string, categoryId: string) => ({ id, categoryId }) as unknown as FinanceBudget;

const book = {
  financeTransactions: [
    txn("t1", "groceries"),
    txn("t2", "groceries"),
    txn("t3", "dining"),
    txn("t4", null),
  ],
  financeMerchants: [merchant("m1", "groceries"), merchant("m2", null), merchant("m3", "software")],
  financeBudgets: [budget("b1", "groceries"), budget("b2", "groceries"), budget("b3", "travel")],
};

const counted = (refs: CategoryReferences) => ({
  transactions: refs.transactions.length,
  merchants: refs.merchants.length,
  budgets: refs.budgets.length,
});

const refs = (transactions: number, merchants: number, budgets = 0): CategoryReferences => ({
  transactions: Array.from({ length: transactions }, (_, index) => txn(`t${index}`, "x")),
  merchants: Array.from({ length: merchants }, (_, index) => merchant(`m${index}`, "x")),
  budgets: Array.from({ length: budgets }, (_, index) => budget(`b${index}`, "x")),
});

describe("indexCategoryReferences", () => {
  it("collects transactions, merchant defaults and budget rows per category", () => {
    const index = indexCategoryReferences(book);
    expect(counted(index.get("groceries") as CategoryReferences)).toEqual({
      transactions: 2,
      merchants: 1,
      budgets: 2,
    });
    expect(counted(index.get("dining") as CategoryReferences)).toEqual({
      transactions: 1,
      merchants: 0,
      budgets: 0,
    });
    expect(counted(index.get("software") as CategoryReferences)).toEqual({
      transactions: 0,
      merchants: 1,
      budgets: 0,
    });
  });

  it("ignores uncategorised rows rather than keying them under null", () => {
    const index = indexCategoryReferences(book);
    expect(index.has("null")).toBe(false);
    expect(index.size).toBe(4);
  });

  it("hands the same rows to a single-category lookup", () => {
    expect(selectCategoryReferences(book, "groceries").transactions.map((row) => row.id)).toEqual([
      "t1",
      "t2",
    ]);
    expect(selectCategoryReferences(book, "travel").budgets.map((row) => row.id)).toEqual(["b3"]);
  });

  it("reports an unreferenced category as absent", () => {
    expect(indexCategoryReferences(book).get("stationery")).toBeUndefined();
    expect(selectCategoryReferences(book, "stationery")).toBe(NO_CATEGORY_REFERENCES);
    expect(isCategoryReferenced(NO_CATEGORY_REFERENCES)).toBe(false);
  });

  it("does not let a budget alone block a hard delete — the delete takes it along", () => {
    expect(isCategoryReferenced(selectCategoryReferences(book, "travel"))).toBe(false);
    expect(selectCategoryReferences(book, "travel").budgets).toHaveLength(1);
  });
});

describe("describeCategoryReferences", () => {
  it("names the row count, and the merchant defaults only when there are some", () => {
    expect(describeCategoryReferences(refs(42, 0))).toBe("42 transactions");
    expect(describeCategoryReferences(refs(42, 2))).toBe("42 transactions and 2 merchant defaults");
  });

  it("reads singular at one", () => {
    expect(describeCategoryReferences(refs(1, 1))).toBe("1 transaction and 1 merchant default");
  });

  it("still names zero transactions, so a blocked dialog never says nothing", () => {
    expect(describeCategoryReferences(refs(0, 3))).toBe("0 transactions and 3 merchant defaults");
  });
});

describe("describeDroppedBudgets", () => {
  it("says nothing when the source carries no budget", () => {
    expect(describeDroppedBudgets(refs(5, 0))).toBeNull();
  });

  it("names what merge removes rather than moves", () => {
    expect(describeDroppedBudgets(refs(5, 0, 3))).toBe(
      "Removes 3 monthly budgets set on it — merge never adds two budgets together.",
    );
  });
});
