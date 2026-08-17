import type { FinanceCategory } from "@vega/shared";

export const FINANCE_CATEGORY_PALETTE = [
  "#5C8A6E",
  "#B3854D",
  "#8B6FA8",
  "#5F87A8",
  "#A86F6F",
  "#7A8B5C",
] as const;

const PALETTE_SIZE = FINANCE_CATEGORY_PALETTE.length;

export function resolveCategoryColorIndex(category: FinanceCategory): number {
  if (category.colorIndex !== null) return category.colorIndex;
  const order = Number.isFinite(category.order) ? Math.max(0, category.order) : 0;
  return order % PALETTE_SIZE;
}

export function nextCategoryColorIndex(existingCategories: FinanceCategory[]): number {
  return existingCategories.length % PALETTE_SIZE;
}

/** The hex a bar, swatch or chart segment paints with — stable per category, never per chart. */
export function getCategoryColor(category: FinanceCategory): string {
  const index = resolveCategoryColorIndex(category) % PALETTE_SIZE;
  return FINANCE_CATEGORY_PALETTE[index] ?? FINANCE_CATEGORY_PALETTE[0];
}
