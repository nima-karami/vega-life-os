import { describe, expect, it } from "vitest";
import { accentVars } from "./accent";

/** Parse a HeroUI `"H S% L%"` channel string into numbers. */
function hsl(v: string): { h: number; s: number; l: number } {
  const m = v.match(/^([\d.]+) ([\d.]+)% ([\d.]+)%$/);
  if (!m) throw new Error(`not an HSL channel string: "${v}"`);
  return { h: Number(m[1]), s: Number(m[2]), l: Number(m[3]) };
}

const SCALE = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;

describe("accentVars", () => {
  it("returns no overrides for empty / invalid input (falls back to theme default)", () => {
    expect(accentVars("")).toEqual({});
    expect(accentVars("   ")).toEqual({});
    expect(accentVars("not-a-color")).toEqual({});
    expect(accentVars("#12")).toEqual({});
  });

  it("converts a hex to the exact HeroUI HSL channel format (anchored to the slate default)", () => {
    // #4e6e8e is the design-system slate primary; HeroUI computes it as
    // `210 29.09% 43.14%`. Our converter must match that byte-for-byte so the
    // override is indistinguishable from a configured theme color.
    const v = accentVars("#4e6e8e");
    expect(v["--heroui-primary"]).toBe("210 29.09% 43.14%");
    expect(v["--heroui-primary-500"]).toBe(v["--heroui-primary"]);
    expect(v["--heroui-focus"]).toBe(v["--heroui-primary"]);
  });

  it("drives every HeroUI primary scale step plus the legacy --color-accent token", () => {
    const v = accentVars("#2bb6a8"); // Teal
    for (const step of SCALE) {
      expect(v[`--heroui-primary-${step}`]).toMatch(/^[\d.]+ [\d.]+% [\d.]+%$/);
    }
    expect(v["--heroui-primary-foreground"]).toMatch(/^[\d.]+ [\d.]+% [\d.]+%$/);
    expect(v["--color-accent"]).toBe("#2bb6a8");
    expect(v["--color-accent-foreground"]).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("accepts shorthand (#rgb) and uppercase hex", () => {
    expect(accentVars("#FFF")["--color-accent"]).toBe("#ffffff");
  });

  it("produces a monotonically darkening lightness ramp (50 lightest → 900 darkest)", () => {
    const v = accentVars("#c9501e"); // Rust
    const ls = SCALE.map((step) => hsl(v[`--heroui-primary-${step}`]).l);
    for (let i = 1; i < ls.length; i++) {
      expect(ls[i]).toBeLessThan(ls[i - 1]);
    }
  });

  it("preserves the base hue across the whole scale", () => {
    const v = accentVars("#7a5cd8"); // Violet
    const base = hsl(v["--heroui-primary-500"]).h;
    for (const step of SCALE) {
      expect(Math.abs(hsl(v[`--heroui-primary-${step}`]).h - base)).toBeLessThan(0.5);
    }
  });

  it("picks a readable foreground: white on dark accents, near-black on light ones", () => {
    expect(accentVars("#3f63d8")["--heroui-primary-foreground"]).toBe("0 0% 100%"); // Cobalt → white
    const goldFg = hsl(accentVars("#c2a14e")["--heroui-primary-foreground"]); // Gold → dark
    expect(goldFg.l).toBeLessThan(20);
  });
});
