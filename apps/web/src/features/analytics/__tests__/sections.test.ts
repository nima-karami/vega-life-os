import { describe, expect, it } from "vitest";
import type { TimeRange } from "../range";
import {
  type AnalyticsDataFlags,
  type PackSection,
  packSections,
  sectionsForRange,
} from "../sections";

/**
 * Simulate two-column left-to-right grid placement and assert no cell is ever
 * empty: a full must start a fresh row, halves fill in pairs, and the last row
 * must be complete (no stranded half).
 */
function isGapFree(packed: PackSection[]): boolean {
  let col = 0;
  for (const s of packed) {
    if (s.span === "full") {
      if (col !== 0) return false; // a full at col 1 strands col 1's cell
    } else {
      col = col === 0 ? 1 : 0;
    }
  }
  return col === 0;
}

const ALL_ON: AnalyticsDataFlags = {
  hasMood: true,
  hasWeekly: true,
  hasLived: true,
  hasInsights: true,
};
const ALL_OFF: AnalyticsDataFlags = {
  hasMood: false,
  hasWeekly: false,
  hasLived: false,
  hasInsights: false,
};
const RANGES: TimeRange[] = ["7d", "30d", "90d", "1y"];

function flagCombos(): AnalyticsDataFlags[] {
  const combos: AnalyticsDataFlags[] = [];
  for (let bits = 0; bits < 16; bits++) {
    combos.push({
      hasMood: !!(bits & 1),
      hasWeekly: !!(bits & 2),
      hasLived: !!(bits & 4),
      hasInsights: !!(bits & 8),
    });
  }
  return combos;
}

describe("packSections", () => {
  it("pairs two consecutive halves into one row", () => {
    expect(
      packSections([
        { id: "reflection", span: "half" },
        { id: "weekday", span: "half" },
      ]),
    ).toEqual([
      { id: "reflection", span: "half" },
      { id: "weekday", span: "half" },
    ]);
  });

  it("promotes a lone half that precedes a full to full width", () => {
    expect(
      packSections([
        { id: "gauge", span: "half" },
        { id: "trend", span: "full" },
      ]),
    ).toEqual([
      { id: "gauge", span: "full" },
      { id: "trend", span: "full" },
    ]);
  });

  it("promotes a lone trailing half to full width", () => {
    expect(packSections([{ id: "habits", span: "half" }])).toEqual([
      { id: "habits", span: "full" },
    ]);
  });

  it("preserves reading order (never reorders, only promotes spans)", () => {
    const input = sectionsForRange("30d", ALL_ON);
    const packed = packSections(input);
    expect(packed.map((s) => s.id)).toEqual(input.map((s) => s.id));
    expect(packed[0].id).toBe("mood");
  });

  it("output is gap-free for every window and every data-flag combination", () => {
    for (const range of RANGES) {
      for (const flags of flagCombos()) {
        const packed = packSections(sectionsForRange(range, flags));
        expect(isGapFree(packed), `range=${range} flags=${JSON.stringify(flags)}`).toBe(true);
      }
    }
  });

  it("7d with only reflection/gauge/goals/habits still leaves no empty cell", () => {
    // The hardest gap case: mood, weekday, heatmap, trend, valueTime, insights all hidden.
    const packed = packSections(sectionsForRange("7d", ALL_OFF));
    expect(isGapFree(packed)).toBe(true);
  });
});

describe("sectionsForRange", () => {
  const ids = (range: TimeRange, flags: AnalyticsDataFlags) =>
    sectionsForRange(range, flags).map((s) => s.id);

  it("hides weekly-trend and heatmap on 7d", () => {
    const shown = ids("7d", ALL_ON);
    expect(shown).not.toContain("trend");
    expect(shown).not.toContain("heatmap");
    expect(shown).toContain("daily");
  });

  it("hides daily-completion and shows the heatmap on the long windows", () => {
    for (const range of ["90d", "1y"] as TimeRange[]) {
      const shown = ids(range, ALL_ON);
      expect(shown).not.toContain("daily");
      expect(shown).toContain("heatmap");
      expect(shown).toContain("trend");
    }
  });

  it("shows mood and weekday only when a mood exists", () => {
    expect(ids("30d", ALL_ON)).toEqual(expect.arrayContaining(["mood", "weekday"]));
    const noMood = ids("30d", { ...ALL_ON, hasMood: false });
    expect(noMood).not.toContain("mood");
    expect(noMood).not.toContain("weekday");
  });

  it("gates valueTime and insights on their data flags", () => {
    expect(ids("30d", ALL_OFF)).not.toContain("valueTime");
    expect(ids("30d", ALL_OFF)).not.toContain("insights");
    expect(ids("30d", ALL_ON)).toEqual(expect.arrayContaining(["valueTime", "insights"]));
  });

  it("always shows the core cards (reflection, gauge, balance, goals, habits)", () => {
    for (const range of RANGES) {
      const shown = ids(range, ALL_OFF);
      expect(shown).toEqual(
        expect.arrayContaining(["reflection", "gauge", "balance", "goals", "habits"]),
      );
    }
  });
});
