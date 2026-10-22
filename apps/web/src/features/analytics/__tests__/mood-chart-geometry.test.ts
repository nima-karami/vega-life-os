import { describe, expect, it } from "vitest";
import {
  averageMood,
  axisTicks,
  buildMoodFootnote,
  buildMoodSummary,
  buildSegments,
  clampTooltipLeft,
  describePoint,
  findNearestLoggedIso,
  moodToTopPercent,
} from "../mood-chart-geometry";
import type { MoodPoint } from "../selectors";

const point = (iso: string, mood: number | null): MoodPoint => ({ iso, label: iso.slice(5), mood });

describe("mood chart geometry", () => {
  it("maps mood 1..5 to 100..0 percent from the top", () => {
    expect(moodToTopPercent(1)).toBe(100);
    expect(moodToTopPercent(3)).toBe(50);
    expect(moodToTopPercent(5)).toBe(0);
  });

  it("joins only adjacent logged points", () => {
    const series = [point("2026-01-01", 1), point("2026-01-02", 5), point("2026-01-03", null)];
    expect(buildSegments(series, 50)).toEqual([{ x1: 0, y1: 100, x2: 50, y2: 0 }]);
  });

  it("finds the nearest logged iso and skips gaps", () => {
    const series = [point("a", 3), point("b", null), point("c", 4)];
    expect(findNearestLoggedIso(series, 50, 40)).toBe("a");
    expect(findNearestLoggedIso(series, 50, 60)).toBe("c");
    expect(findNearestLoggedIso([point("a", null)], 0, 10)).toBeNull();
  });

  it("samples five ticks including first and last", () => {
    const series = Array.from({ length: 9 }, (_, i) => point(`2026-01-0${i + 1}`, 3));
    const ticks = axisTicks(series);
    expect(ticks).toHaveLength(5);
    expect(ticks[0].key).toBe("2026-01-01");
    expect(ticks[4].key).toBe("2026-01-09");
    expect(axisTicks(series.slice(0, 3))).toHaveLength(3);
  });

  it("describes a gap by its label alone", () => {
    expect(describePoint(point("2026-01-01", null), "day")).toBe("01-01");
    expect(describePoint(point("2026-01-01", 5), "week")).toContain("Week of 01-01");
  });

  it("averages logged moods and treats none as 0", () => {
    expect(averageMood([])).toBe(0);
    expect(averageMood([point("a", 2), point("b", 4)])).toBe(3);
  });

  it("builds the summary and footnote for empty and populated ranges", () => {
    expect(buildMoodSummary([], 7, "day")).toBe("No mood logged in this range.");
    expect(buildMoodSummary([point("a", 3)], 7, "day")).toContain("the last 7 days");
    expect(buildMoodSummary([point("a", 3)], 52, "week")).toContain("the year, by week");
    expect(buildMoodFootnote(0, "day", false)).toBe("No mood logged in this range.");
    expect(buildMoodFootnote(1, "day", false)).toBe(
      "1 day logged: tap a point to open that day's journal. Gaps are unrecorded days.",
    );
    expect(buildMoodFootnote(2, "week", true)).toBe(
      "2 weeks logged: tap a point to see the day, tap again to open its journal. Gaps are unrecorded weeks.",
    );
  });

  it("clamps the tooltip away from both edges", () => {
    expect(clampTooltipLeft(0, 25)).toBe(25);
    expect(clampTooltipLeft(50, 25)).toBe(50);
    expect(clampTooltipLeft(100, 25)).toBe(75);
  });
});
