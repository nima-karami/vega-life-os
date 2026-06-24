import { describe, expect, it } from "vitest";
import { ACCENT_VAR_KEYS, accentVars } from "./accent";

describe("accentVars", () => {
  it("returns no overrides for empty / invalid input (falls back to theme default)", () => {
    expect(accentVars("")).toEqual({});
    expect(accentVars("   ")).toEqual({});
    expect(accentVars("not-a-color")).toEqual({});
    expect(accentVars("#12")).toEqual({});
  });

  it("emits v3 --accent as the picked hex (normalized lowercase)", () => {
    const v = accentVars("#4E6E8E"); // design-system slate primary
    expect(v["--accent"]).toBe("#4e6e8e");
    expect(v["--focus"]).toBe("#4e6e8e");
    expect(v["--color-accent"]).toBe("#4e6e8e"); // legacy alias kept in sync
  });

  it("drives the v3 accent token set plus the legacy --color-accent token", () => {
    const v = accentVars("#2bb6a8"); // Teal
    expect(v["--accent"]).toBe("#2bb6a8");
    expect(v["--accent-foreground"]).toMatch(/^#[0-9a-f]{6}$/);
    // Calculated states derive from the base via color-mix.
    expect(v["--accent-hover"]).toContain("color-mix");
    expect(v["--accent-soft"]).toContain("color-mix");
    expect(v["--color-accent"]).toBe("#2bb6a8");
    expect(v["--color-accent-foreground"]).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("accepts shorthand (#rgb) and uppercase hex", () => {
    expect(accentVars("#FFF")["--accent"]).toBe("#ffffff");
  });

  it("picks a readable foreground: white on dark accents, near-black on light ones", () => {
    expect(accentVars("#3f63d8")["--accent-foreground"]).toBe("#ffffff"); // Cobalt → white
    expect(accentVars("#c2a14e")["--accent-foreground"]).toBe("#1f1f1f"); // Gold → dark
  });

  it("only ever emits keys declared in ACCENT_VAR_KEYS (so the applier can clear them all)", () => {
    const v = accentVars("#7a5cd8"); // Violet
    for (const key of Object.keys(v)) {
      expect(ACCENT_VAR_KEYS).toContain(key);
    }
  });
});
