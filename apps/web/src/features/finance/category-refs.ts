import type { FinanceMerchant, FinanceTransaction } from "@vega/shared";

/** What still points at a category — the numbers delete and merge have to be honest about. */
export interface CategoryReferences {
  transactions: number;
  merchants: number;
}

export interface CategoryReferenceBook {
  financeTransactions: FinanceTransaction[];
  financeMerchants: FinanceMerchant[];
}

export const NO_CATEGORY_REFERENCES: CategoryReferences = { transactions: 0, merchants: 0 };

export function indexCategoryReferences(
  book: CategoryReferenceBook,
): Map<string, CategoryReferences> {
  const index = new Map<string, CategoryReferences>();
  const bump = (categoryId: string | null, field: keyof CategoryReferences) => {
    if (categoryId === null) return;
    const current = index.get(categoryId) ?? NO_CATEGORY_REFERENCES;
    index.set(categoryId, { ...current, [field]: current[field] + 1 });
  };
  for (const txn of book.financeTransactions) bump(txn.categoryId, "transactions");
  for (const merchant of book.financeMerchants) bump(merchant.defaultCategoryId, "merchants");
  return index;
}

export const isCategoryReferenced = (refs: CategoryReferences): boolean =>
  refs.transactions > 0 || refs.merchants > 0;

export const countNoun = (count: number, noun: string): string =>
  `${count} ${noun}${count === 1 ? "" : "s"}`;

/** "42 transactions and 2 merchant defaults" — the phrase both destructive dialogs promise. */
export function describeCategoryReferences(refs: CategoryReferences): string {
  const parts = [countNoun(refs.transactions, "transaction")];
  if (refs.merchants > 0) parts.push(countNoun(refs.merchants, "merchant default"));
  return parts.join(" and ");
}
