import type { FinanceMerchant, FinanceTransaction } from "@vega/shared";
import { describe, expect, it } from "vitest";
import {
  describeCategoryReferences,
  indexCategoryReferences,
  isCategoryReferenced,
  NO_CATEGORY_REFERENCES,
} from "../category-refs";

const txn = (id: string, categoryId: string | null) =>
  ({ id, categoryId }) as unknown as FinanceTransaction;
const merchant = (id: string, defaultCategoryId: string | null) =>
  ({ id, defaultCategoryId }) as unknown as FinanceMerchant;

const book = {
  financeTransactions: [
    txn("t1", "groceries"),
    txn("t2", "groceries"),
    txn("t3", "dining"),
    txn("t4", null),
  ],
  financeMerchants: [merchant("m1", "groceries"), merchant("m2", null), merchant("m3", "software")],
};

describe("indexCategoryReferences", () => {
  it("counts transactions and merchant defaults per category", () => {
    const index = indexCategoryReferences(book);
    expect(index.get("groceries")).toEqual({ transactions: 2, merchants: 1 });
    expect(index.get("dining")).toEqual({ transactions: 1, merchants: 0 });
    expect(index.get("software")).toEqual({ transactions: 0, merchants: 1 });
  });

  it("ignores uncategorised rows rather than keying them under null", () => {
    const index = indexCategoryReferences(book);
    expect(index.has("null")).toBe(false);
    expect(index.size).toBe(3);
  });

  it("reports an unreferenced category as absent", () => {
    expect(indexCategoryReferences(book).get("travel")).toBeUndefined();
    expect(isCategoryReferenced(NO_CATEGORY_REFERENCES)).toBe(false);
  });
});

describe("describeCategoryReferences", () => {
  it("names the row count, and the merchant defaults only when there are some", () => {
    expect(describeCategoryReferences({ transactions: 42, merchants: 0 })).toBe("42 transactions");
    expect(describeCategoryReferences({ transactions: 42, merchants: 2 })).toBe(
      "42 transactions and 2 merchant defaults",
    );
  });

  it("reads singular at one", () => {
    expect(describeCategoryReferences({ transactions: 1, merchants: 1 })).toBe(
      "1 transaction and 1 merchant default",
    );
  });

  it("still names zero transactions, so a blocked dialog never says nothing", () => {
    expect(describeCategoryReferences({ transactions: 0, merchants: 3 })).toBe(
      "0 transactions and 3 merchant defaults",
    );
  });
});
