/**
 * Accent → theme tokens.
 *
 * The Appearance accent picker re-tints the whole app. After the calm-HeroUI
 * redesign every primary surface (buttons, chips, active nav, the calendar
 * now-line, links) reads HeroUI's `--heroui-primary*` tokens, so a custom accent
 * has to override those — not just the legacy `--color-accent` var a few older
 * surfaces (date picker, charts) still use.
 *
 * `accentVars(hex)` returns the exact CSS custom properties to set on the root.
 * An empty/invalid hex returns `{}` — the caller clears any overrides so the
 * configured theme default (slate, from hero.ts) shows through.
 *
 * Pure + deterministic so it can be unit-tested without a DOM.
 */

/** HeroUI primary scale steps, lightest → darkest. 500 is the DEFAULT. */
const SCALE = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;

/**
 * Per-step blend toward white (positive: lighter than base) or black (negative:
 * darker). 500 is the base color untouched. Tuned to read like a normal HeroUI
 * tonal ramp while staying strictly monotonic for any base lightness.
 */
const MIX: Record<(typeof SCALE)[number], number> = {
  50: 0.9,
  100: 0.8,
  200: 0.62,
  300: 0.42,
  400: 0.2,
  500: 0,
  600: -0.16,
  700: -0.32,
  800: -0.48,
  900: -0.64,
};

interface Rgb {
  r: number;
  g: number;
  b: number;
}
interface Hsl {
  h: number;
  s: number;
  l: number;
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

function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l: l * 100 };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s: s * 100, l: l * 100 };
}

/** WCAG relative luminance (0 black → 1 white). */
function luminance({ r, g, b }: Rgb): number {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Round to 2 decimals, dropping a trailing `.0` (HeroUI emits e.g. `43.14` and `210`). */
function n2(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/** Format an HSL as HeroUI's space-separated `"H S% L%"` channel string. */
function channels({ h, s, l }: Hsl): string {
  return `${n2(h)} ${n2(s)}% ${n2(l)}%`;
}

/**
 * Every CSS custom property `accentVars` may set, as a stable list. The applier
 * iterates this (not just the current map's keys) so switching to "Default" — or
 * to a lighter accent that emits fewer keys — clears every previously-set var.
 */
export const ACCENT_VAR_KEYS: readonly string[] = [
  "--heroui-primary",
  ...SCALE.map((s) => `--heroui-primary-${s}`),
  "--heroui-primary-foreground",
  "--heroui-focus",
  "--color-accent",
  "--color-accent-foreground",
];

export function accentVars(hex: string): Record<string, string> {
  const rgb = parseHex(hex);
  if (!rgb) return {};

  const base = rgbToHsl(rgb);
  const normHex = toHex(rgb);

  // Foreground: whichever of white / near-black contrasts better with the base.
  const lum = luminance(rgb);
  const onWhite = (1.0 + 0.05) / (lum + 0.05);
  const onBlack = (lum + 0.05) / (0.0 + 0.05);
  const darkFg = onBlack >= onWhite;
  const fgChannels = darkFg ? "0 0% 12%" : "0 0% 100%";
  const fgHex = darkFg ? "#1f1f1f" : "#ffffff";

  const vars: Record<string, string> = {
    "--heroui-primary-foreground": fgChannels,
    "--color-accent": normHex,
    "--color-accent-foreground": fgHex,
  };

  for (const step of SCALE) {
    const mix = MIX[step];
    const l = mix >= 0 ? base.l + (100 - base.l) * mix : base.l * (1 + mix);
    const value = channels({ h: base.h, s: base.s, l });
    vars[`--heroui-primary-${step}`] = value;
    if (step === 500) {
      vars["--heroui-primary"] = value;
      vars["--heroui-focus"] = value;
    }
  }

  return vars;
}
