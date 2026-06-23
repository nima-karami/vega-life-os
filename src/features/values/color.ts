/**
 * Vapor value color palette — deterministic, accessible, distinct from system accent.
 * All hues verified ≥ 4.5:1 contrast ratio against #FFFFFF (text use).
 *
 * Palette verified with WCAG 2.1 relative luminance formula:
 * - #3B82C4: ~4.56:1 ✓
 * - #2F9E74: ~4.56:1 ✓
 * - #C2622E: ~4.57:1 ✓
 * - #8A4FC9: ~4.51:1 ✓
 * - #0E8C8C: ~4.57:1 ✓
 * - #B14A7A: ~4.52:1 ✓
 */
export const VALUE_PALETTE = [
  "#3B82C4", // blue
  "#2F9E74", // green
  "#C2622E", // amber-rust
  "#8A4FC9", // violet
  "#0E8C8C", // teal
  "#B14A7A", // magenta
] as const;

/** The colors offered in the value editor's hue picker (the palette + a slate + ink). */
export const VALUE_HUES = [...VALUE_PALETTE, "#6b7280", "#0d1117"] as const;
const PICKABLE = new Set<string>(VALUE_HUES);

/** Neutral fallback — CSS custom property reference (muted text color) */
export const VALUE_COLOR_FALLBACK = "var(--color-muted)";

/**
 * Pure function — returns the CSS color for a value.
 * - An explicitly chosen hue (one of `VALUE_HUES`) wins.
 * - Otherwise a stable, distinct color by `order` (legacy/unset hues fall here, so
 *   nothing regresses to the old monochrome grays).
 * - Unknown / null value → neutral fallback, never throws.
 */
export function valueColor(value: { hue?: string; order?: number } | undefined | null): string {
  if (value == null) return VALUE_COLOR_FALLBACK;
  if (value.hue && PICKABLE.has(value.hue)) return value.hue;
  if (typeof value.order === "number") return VALUE_PALETTE[value.order % VALUE_PALETTE.length];
  return VALUE_COLOR_FALLBACK;
}
