import { describe, expect, it } from "vitest";
import { ACCENT_VAR_KEYS, getAccentVars } from "./accent";

function relativeLuminance(hex: string): number {
  const h = hex.replace("#", "");
  const channel = (i: number) => {
    const v = Number.parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

// The curated Appearance palette (SettingsPage). Default's slate is the CSS
// fallback (#4e6e8e) since its stored hex is "".
const CURATED_ACCENTS = ["#4e6e8e", "#2563eb", "#047857", "#d97706", "#e11d48", "#7c3aed"];

describe("getAccentVars", () => {
  it("returns no overrides for empty / invalid input (falls back to theme default)", () => {
    expect(getAccentVars("")).toEqual({});
    expect(getAccentVars("   ")).toEqual({});
    expect(getAccentVars("not-a-color")).toEqual({});
    expect(getAccentVars("#12")).toEqual({});
  });

  it("emits v3 --accent as the picked hex (normalized lowercase)", () => {
    const v = getAccentVars("#4E6E8E"); // design-system slate primary
    expect(v["--accent"]).toBe("#4e6e8e");
    expect(v["--focus"]).toBe("#4e6e8e");
    expect(v["--color-accent"]).toBe("#4e6e8e"); // legacy alias kept in sync
  });

  it("drives the v3 accent token set plus the legacy --color-accent token", () => {
    const v = getAccentVars("#2bb6a8"); // Teal
    expect(v["--accent"]).toBe("#2bb6a8");
    expect(v["--accent-foreground"]).toMatch(/^#[0-9a-f]{6}$/);
    // Calculated states derive from the base via color-mix.
    expect(v["--accent-hover"]).toContain("color-mix");
    expect(v["--accent-soft"]).toContain("color-mix");
    expect(v["--color-accent"]).toBe("#2bb6a8");
    expect(v["--color-accent-foreground"]).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("accepts shorthand (#rgb) and uppercase hex", () => {
    expect(getAccentVars("#FFF")["--accent"]).toBe("#ffffff");
  });

  it("picks a readable foreground: white on dark accents, near-black on light ones", () => {
    expect(getAccentVars("#3f63d8")["--accent-foreground"]).toBe("#ffffff"); // Cobalt → white
    expect(getAccentVars("#c2a14e")["--accent-foreground"]).toBe("#1f1f1f"); // Gold → dark
  });

  it("picks the genuinely higher-contrast foreground for a mid-luminance accent", () => {
    const accent = "#d97706"; // Amber: white 3.1:1 vs near-black 5.2:1 → near-black wins
    const fg = getAccentVars(accent)["--accent-foreground"];
    expect(fg).toBe("#1f1f1f");
    expect(contrastRatio(accent, fg)).toBeGreaterThan(contrastRatio(accent, "#ffffff"));
  });

  it("every curated accent clears WCAG AA (4.5:1) against its computed foreground", () => {
    for (const accent of CURATED_ACCENTS) {
      const fg = getAccentVars(accent)["--accent-foreground"];
      expect(contrastRatio(accent, fg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("only ever emits keys declared in ACCENT_VAR_KEYS (so the applier can clear them all)", () => {
    const v = getAccentVars("#7a5cd8"); // Violet
    for (const key of Object.keys(v)) {
      expect(ACCENT_VAR_KEYS).toContain(key);
    }
  });
});
