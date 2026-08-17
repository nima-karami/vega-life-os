/**
 * Categories are the owner's own, so there is no fixed taxonomy to colour — the palette is six
 * hues handed out round-robin and then held stable, never re-picked per chart.
 */
export const FINANCE_CATEGORY_COLORS = [
  "#5C8A6E",
  "#B3854D",
  "#8B6FA8",
  "#5F87A8",
  "#A86F6F",
  "#7A8B5C",
] as const;

export const FINANCE_CATEGORY_COLOR_COUNT = FINANCE_CATEGORY_COLORS.length;

export function getCategoryColor(colorIndex: number): string {
  const wrapped =
    ((Math.trunc(colorIndex) % FINANCE_CATEGORY_COLOR_COUNT) + FINANCE_CATEGORY_COLOR_COUNT) %
    FINANCE_CATEGORY_COLOR_COUNT;
  return FINANCE_CATEGORY_COLORS[wrapped] ?? FINANCE_CATEGORY_COLORS[0];
}

/** A category stored before the palette existed falls back to its list position, so it still reads. */
export const resolveCategoryColorIndex = (colorIndex: number | undefined, order: number): number =>
  colorIndex ?? order;
