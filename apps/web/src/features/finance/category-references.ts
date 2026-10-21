import type { FinanceBudget, FinanceMerchant, FinanceTransaction } from "@vega/shared";
import { pluralize } from "@/core/lib/plural";

/** Every row that points at one category — what the count, the delete and the merge all read. */
export interface CategoryReferences {
  transactions: FinanceTransaction[];
  merchants: FinanceMerchant[];
  budgets: FinanceBudget[];
}

export interface CategoryReferenceBook {
  financeTransactions: FinanceTransaction[];
  financeMerchants: FinanceMerchant[];
  financeBudgets: FinanceBudget[];
}

export const NO_CATEGORY_REFERENCES: CategoryReferences = {
  transactions: [],
  merchants: [],
  budgets: [],
};

/** One pass over the book; every screen and every destructive action reads this index. */
export function indexCategoryReferences(
  book: CategoryReferenceBook,
): Map<string, CategoryReferences> {
  const index = new Map<string, CategoryReferences>();
  const at = (categoryId: string | null): CategoryReferences | null => {
    if (categoryId === null) return null;
    const known = index.get(categoryId);
    if (known) return known;
    const fresh: CategoryReferences = { transactions: [], merchants: [], budgets: [] };
    index.set(categoryId, fresh);
    return fresh;
  };
  for (const txn of book.financeTransactions) at(txn.categoryId)?.transactions.push(txn);
  for (const merchant of book.financeMerchants)
    at(merchant.defaultCategoryId)?.merchants.push(merchant);
  for (const budget of book.financeBudgets) at(budget.categoryId)?.budgets.push(budget);
  return index;
}

export const selectCategoryReferences = (
  book: CategoryReferenceBook,
  categoryId: string,
): CategoryReferences => indexCategoryReferences(book).get(categoryId) ?? NO_CATEGORY_REFERENCES;

/**
 * Budgets are deliberately out: they are the owner's intent, not history, so a category budgeted
 * but never spent against is still safe to hard-delete — the delete just takes its budgets with it.
 */
export const isCategoryReferenced = (references: CategoryReferences): boolean =>
  references.transactions.length > 0 || references.merchants.length > 0;

/** "42 transactions and 2 merchant defaults" — the phrase both destructive dialogs promise. */
export function describeCategoryReferences(references: CategoryReferences): string {
  const parts = [pluralize(references.transactions.length, "transaction")];
  if (references.merchants.length > 0)
    parts.push(pluralize(references.merchants.length, "merchant default"));
  return parts.join(" and ");
}

/** Merge never adds two budgets together, so the source's own rows go rather than move. */
export function describeDroppedBudgets(references: CategoryReferences): string | null {
  if (references.budgets.length === 0) return null;
  return `Removes ${pluralize(references.budgets.length, "monthly budget")} set on it. Merge never adds two budgets together.`;
}
