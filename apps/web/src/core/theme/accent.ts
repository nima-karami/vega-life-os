/**
 * Accent → theme tokens (HeroUI v3).
 *
 * The Appearance accent picker re-tints the whole app. In v3 the brand color is
 * the single `--accent` token (plus `--accent-foreground`, and calculated
 * `--accent-hover`/`--accent-soft` states) — there are no numbered scales. So a
 * custom accent overrides those v3 tokens, plus the legacy `--color-accent` var a
 * few older surfaces (date picker, charts) still read.
 *
 * `getAccentVars(hex)` returns the exact CSS custom properties to set on the root.
 * An empty/invalid hex returns `{}` — the caller clears any overrides so the
 * configured theme default (slate) shows through.
 *
 * Pure + deterministic so it can be unit-tested without a DOM.
 */

interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Parse `#rgb` / `#rrggbb` (any case) → 0–255 channels, or null if malformed. */
function parseHex(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return {
    r: Number.parseInt(h.slice(0, 2), 16),
    g: Number.parseInt(h.slice(2, 4), 16),
    b: Number.parseInt(h.slice(4, 6), 16),
  };
}

function toHex({ r, g, b }: Rgb): string {
  const c = (n: number) =>
    Math.round(Math.max(0, Math.min(255, n)))
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** WCAG relative luminance (0 black → 1 white). */
function luminance({ r, g, b }: Rgb): number {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * Every CSS custom property `getAccentVars` may set, as a stable list. The applier
 * iterates this (not just the current map's keys) so switching to "Default"
 * clears every previously-set var.
 *
 * v3 calculated states use color-mix() over the base `--accent`, matching the
 * HeroUI default theme's own `--accent-hover` / `--accent-soft` formulas.
 */
export const ACCENT_VAR_KEYS: readonly string[] = [
  "--accent",
  "--accent-foreground",
  "--accent-hover",
  "--accent-soft",
  "--accent-soft-foreground",
  "--focus",
  "--color-accent",
  "--color-accent-foreground",
];

export function getAccentVars(hex: string): Record<string, string> {
  const rgb = parseHex(hex);
  if (!rgb) return {};

  const normHex = toHex(rgb);

  // Foreground: whichever of white / near-black contrasts better with the base.
  const lum = luminance(rgb);
  const onWhite = (1.0 + 0.05) / (lum + 0.05);
  const onBlack = (lum + 0.05) / (0.0 + 0.05);
  const darkFg = onBlack >= onWhite;
  const fgHex = darkFg ? "#1f1f1f" : "#ffffff";

  return {
    "--accent": normHex,
    "--accent-foreground": fgHex,
    // Calculated states mirror @heroui/styles' default-theme formulas.
    "--accent-hover": `color-mix(in oklab, ${normHex} 90%, ${fgHex} 10%)`,
    "--accent-soft": `color-mix(in oklab, ${normHex} 12%, var(--surface) 88%)`,
    "--accent-soft-foreground": normHex,
    "--focus": normHex,
    // Legacy aliases still read by the date picker + charts.
    "--color-accent": normHex,
    "--color-accent-foreground": fgHex,
  };
}
