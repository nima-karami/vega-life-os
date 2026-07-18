import { describe, expect, it } from "vitest";
import { ANALYTICS_SECTIONS, type PackSection } from "../sections";

/** Walk the layout as a two-column grid and assert no cell is ever stranded:
 *  a full must start a fresh row, halves fill in pairs, the last row is complete. */
function isGapFree(sections: PackSection[]): boolean {
  let col = 0;
  for (const s of sections) {
    if (s.span === "full") {
      if (col !== 0) return false;
    } else {
      col = col === 0 ? 1 : 0;
    }
  }
  return col === 0;
}

describe("ANALYTICS_SECTIONS", () => {
  it("is the fixed six-card layout in reading order", () => {
    expect(ANALYTICS_SECTIONS.map((s) => s.id)).toEqual([
      "mood",
      "reflection",
      "heatmap",
      "balance",
      "habits",
      "goals",
    ]);
  });

  it("packs gap-free in a two-column grid", () => {
    expect(isGapFree(ANALYTICS_SECTIONS)).toBe(true);
  });
});
