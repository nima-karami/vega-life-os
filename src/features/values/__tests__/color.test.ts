import { describe, expect, it } from "vitest";
import { VALUE_COLOR_FALLBACK, VALUE_HUES, VALUE_PALETTE, valueColor } from "../color";

describe("valueColor", () => {
  it("returns a color from the palette for order 0", () => {
    expect(valueColor({ order: 0 })).toBe(VALUE_PALETTE[0]);
  });

  it("returns a color from the palette for order 1", () => {
    expect(valueColor({ order: 1 })).toBe(VALUE_PALETTE[1]);
  });

  it("wraps modulo when order exceeds palette length", () => {
    const len = VALUE_PALETTE.length;
    expect(valueColor({ order: len })).toBe(VALUE_PALETTE[0]);
    expect(valueColor({ order: len + 1 })).toBe(VALUE_PALETTE[1]);
    expect(valueColor({ order: len * 3 + 2 })).toBe(VALUE_PALETTE[2]);
  });

  it("is deterministic — same order always returns same color", () => {
    const a = valueColor({ order: 3 });
    const b = valueColor({ order: 3 });
    expect(a).toBe(b);
  });

  it("returns fallback for null without throwing", () => {
    expect(() => valueColor(null)).not.toThrow();
    expect(valueColor(null)).toBe(VALUE_COLOR_FALLBACK);
  });

  it("returns fallback for undefined without throwing", () => {
    expect(() => valueColor(undefined)).not.toThrow();
    expect(valueColor(undefined)).toBe(VALUE_COLOR_FALLBACK);
  });

  it("honors an explicitly chosen hue over the order-based color", () => {
    for (const hue of VALUE_HUES) {
      expect(valueColor({ hue, order: 0 })).toBe(hue);
    }
  });

  it("falls back to the order-based palette for legacy/unset hues", () => {
    // legacy monochrome seed grays are not pickable → order-based, not gray
    expect(valueColor({ hue: "#1f1f19", order: 1 })).toBe(VALUE_PALETTE[1]);
    expect(valueColor({ hue: "", order: 2 })).toBe(VALUE_PALETTE[2]);
    expect(valueColor({ hue: "#55554c", order: 0 })).toBe(VALUE_PALETTE[0]);
  });

  it("every pickable hue is a valid hex color", () => {
    for (const hex of VALUE_HUES) {
      expect(hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("palette has at least 6 hues", () => {
    expect(VALUE_PALETTE.length).toBeGreaterThanOrEqual(6);
  });

  it("all palette entries are valid hex colors", () => {
    for (const hex of VALUE_PALETTE) {
      expect(hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});
