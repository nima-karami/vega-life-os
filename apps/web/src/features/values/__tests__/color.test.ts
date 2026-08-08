import { describe, expect, it } from "vitest";
import {
  getValueCardFill,
  getValueColor,
  RETIRED_HUE_REPLACEMENT,
  VALUE_COLOR_FALLBACK,
  VALUE_HUES,
  VALUE_PALETTE,
} from "../color";

describe("getValueColor", () => {
  it("returns a color from the palette for order 0", () => {
    expect(getValueColor({ order: 0 })).toBe(VALUE_PALETTE[0]);
  });

  it("returns a color from the palette for order 1", () => {
    expect(getValueColor({ order: 1 })).toBe(VALUE_PALETTE[1]);
  });

  it("wraps modulo when order exceeds palette length", () => {
    const len = VALUE_PALETTE.length;
    expect(getValueColor({ order: len })).toBe(VALUE_PALETTE[0]);
    expect(getValueColor({ order: len + 1 })).toBe(VALUE_PALETTE[1]);
    expect(getValueColor({ order: len * 3 + 2 })).toBe(VALUE_PALETTE[2]);
  });

  it("is deterministic — same order always returns same color", () => {
    const a = getValueColor({ order: 3 });
    const b = getValueColor({ order: 3 });
    expect(a).toBe(b);
  });

  it("returns fallback for null without throwing", () => {
    expect(() => getValueColor(null)).not.toThrow();
    expect(getValueColor(null)).toBe(VALUE_COLOR_FALLBACK);
  });

  it("returns fallback for undefined without throwing", () => {
    expect(() => getValueColor(undefined)).not.toThrow();
    expect(getValueColor(undefined)).toBe(VALUE_COLOR_FALLBACK);
  });

  it("honors an explicitly chosen hue over the order-based color", () => {
    for (const hue of VALUE_HUES) {
      expect(getValueColor({ hue, order: 0 })).toBe(hue);
    }
  });

  it("falls back to the order-based palette for legacy/unset hues", () => {
    // legacy monochrome seed grays are not pickable → order-based, not gray
    expect(getValueColor({ hue: "#1f1f19", order: 1 })).toBe(VALUE_PALETTE[1]);
    expect(getValueColor({ hue: "", order: 2 })).toBe(VALUE_PALETTE[2]);
    expect(getValueColor({ hue: "#55554c", order: 0 })).toBe(VALUE_PALETTE[0]);
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

  it("resolves a retired hue to its replacement rather than the order color", () => {
    for (const [retired, replacement] of Object.entries(RETIRED_HUE_REPLACEMENT)) {
      expect(getValueColor({ hue: retired, order: 3 })).toBe(replacement);
    }
  });

  it("offers no retired hue in the picker", () => {
    for (const retired of Object.keys(RETIRED_HUE_REPLACEMENT)) {
      expect(VALUE_HUES).not.toContain(retired);
    }
  });
});

describe("getValueCardFill", () => {
  it("returns a distinct, darker fill for every pickable hue", () => {
    const fills = VALUE_HUES.map((hue) => getValueCardFill({ hue }));
    expect(new Set(fills).size).toBe(VALUE_HUES.length);
    for (const [i, fill] of fills.entries()) {
      expect(fill).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(luminance(fill)).toBeLessThan(luminance(VALUE_HUES[i]));
    }
  });

  it("clears 7:1 against the white type it carries", () => {
    for (const hue of VALUE_HUES) {
      const ratio = 1.05 / (luminance(getValueCardFill({ hue })) + 0.05);
      expect(ratio).toBeGreaterThan(7);
    }
  });

  it("fills a retired hue with its replacement's fill", () => {
    for (const [retired, replacement] of Object.entries(RETIRED_HUE_REPLACEMENT)) {
      expect(getValueCardFill({ hue: retired })).toBe(getValueCardFill({ hue: replacement }));
    }
  });

  it("falls back to the swatch when there is no mapped fill", () => {
    expect(getValueCardFill(null)).toBe(VALUE_COLOR_FALLBACK);
  });
});

function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = Number.parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}
