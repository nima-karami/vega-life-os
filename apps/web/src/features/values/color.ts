/**
 * Value colour palette. Two hexes per hue: the **swatch** the user picks and sees as
 * text/dot, and the deepened **card fill** the entity card is flooded with.
 *
 * Swatches are ≥ 4.5:1 on white (text use); fills clear 7.6–10.2:1 against white
 * (the card's own type), and no two fills are closer than ΔE 16 in CIELAB.
 *
 * The palette is the whole picker set; there are no neutrals: as a flooded card, grey
 * reads as "no colour" and ink as broken blue.
 */
export const VALUE_HUES = [
  "#3B82C4", // blue
  "#2F9E74", // green
  "#C2622E", // rust
  "#8A4FC9", // violet
  "#0E8C8C", // teal
  "#B14A7A", // magenta
  "#B08430", // amber
  "#5E7A3A", // olive
] as const;

const PICKABLE = new Set<string>(VALUE_HUES);

const CARD_FILL: Record<string, string> = {
  "#3B82C4": "#234E76",
  "#2F9E74": "#1C5F46",
  "#C2622E": "#743B1C",
  "#8A4FC9": "#532F79",
  "#0E8C8C": "#085454",
  "#B14A7A": "#6A2C49",
  "#B08430": "#6A4F1D",
  "#5E7A3A": "#384923",
};

/** Hues retired when the card became the colour, mapped to their nearest surviving
 *  neighbour in CIELAB (slate ΔE 31.0, ink ΔE 56.6 — teal wins both). */
export const RETIRED_HUE_REPLACEMENT: Record<string, string> = {
  "#6b7280": "#0E8C8C",
  "#0d1117": "#0E8C8C",
};

/** Neutral fallback — CSS custom property reference (muted text color) */
export const VALUE_COLOR_FALLBACK = "var(--color-muted)";

/**
 * Pure function — returns the CSS color for a value.
 * - An explicitly chosen hue (one of `VALUE_HUES`) wins.
 * - A retired hue resolves to its replacement, so a value renders correctly even
 *   before the migration has written the new hex.
 * - Otherwise a stable, distinct color by `order`.
 * - Unknown / null value → neutral fallback, never throws.
 */
export function getValueColor(value: { hue?: string; order?: number } | undefined | null): string {
  if (value == null) return VALUE_COLOR_FALLBACK;
  const retired = value.hue ? RETIRED_HUE_REPLACEMENT[value.hue.toLowerCase()] : undefined;
  if (retired) return retired;
  if (value.hue && PICKABLE.has(value.hue)) return value.hue;
  if (typeof value.order === "number") return VALUE_HUES[value.order % VALUE_HUES.length];
  return VALUE_COLOR_FALLBACK;
}

/** The deepened fill an entity card is flooded with — white type sits on this, never
 *  on the swatch. Falls back to the swatch so an unmapped colour still renders. */
export function getValueCardFill(
  value: { hue?: string; order?: number } | undefined | null,
): string {
  const swatch = getValueColor(value);
  return CARD_FILL[swatch] ?? swatch;
}
