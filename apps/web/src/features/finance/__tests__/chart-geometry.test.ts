import { describe, expect, it } from "vitest";
import {
  BURN_FRAME,
  buildBurnGeometry,
  buildStackedBars,
  buildTrendGeometry,
  chooseAxisMax,
  toPolylinePoints,
} from "../overview/chart-geometry";

const sample = (month: string, cents: number, budgetCents: number | null, isOpen = false) => ({
  month,
  cents,
  budgetCents,
  isOpen,
});

describe("chooseAxisMax", () => {
  it("rounds up to a step whose half is still a round figure", () => {
    expect(chooseAxisMax(70000)).toBe(80000);
    expect(chooseAxisMax(45000)).toBe(50000);
    expect(chooseAxisMax(10000)).toBe(10000);
  });

  it("never returns zero, so a scale can always divide by it", () => {
    expect(chooseAxisMax(0)).toBe(100);
    expect(chooseAxisMax(-500)).toBe(100);
  });
});

describe("buildTrendGeometry", () => {
  it("spreads the points evenly and scales against the taller of spend and budget", () => {
    const geometry = buildTrendGeometry([
      sample("2026-06", 20000, 70000),
      sample("2026-07", 40000, 70000),
      sample("2026-08", 24010, 70000, true),
    ]);

    expect(geometry.axisMaxCents).toBe(80000);
    expect(geometry.points.map((point) => Math.round(point.x))).toEqual([55, 265, 475]);
    expect(geometry.points[0]?.y).toBeCloseTo(150 - (20000 / 80000) * 130, 5);
    expect(geometry.budgetY).toBeCloseTo(150 - (70000 / 80000) * 130, 5);
  });

  it("marks a completed month past its own budget as a breach and never an open one", () => {
    const geometry = buildTrendGeometry([
      sample("2026-06", 80000, 70000),
      sample("2026-07", 60000, 70000),
      sample("2026-08", 90000, 70000, true),
    ]);

    expect(geometry.points.map((point) => point.isBreach)).toEqual([true, false, false]);
    expect(geometry.points.at(-1)?.isOpen).toBe(true);
  });

  it("keeps every point finite when nothing was spent in any month", () => {
    const geometry = buildTrendGeometry([
      sample("2026-02", 0, null),
      sample("2026-03", 0, null, true),
    ]);
    expect(geometry.axisMaxCents).toBeGreaterThan(0);
    expect(geometry.points.every((point) => Number.isFinite(point.y))).toBe(true);
  });

  it("tops the axis at or above the tallest sample", () => {
    const geometry = buildTrendGeometry([sample("2026-03", 123456, 200000)]);
    expect(geometry.axisMaxCents).toBeGreaterThanOrEqual(200000);
  });

  it("draws no budget line when no budget is in force for the scoped month", () => {
    const geometry = buildTrendGeometry([sample("2026-08", 1000, null)]);
    expect(geometry.budgetY).toBeNull();
    expect(geometry.points[0]?.x).toBe(55);
  });
});

describe("buildBurnGeometry", () => {
  const figures = {
    cumulativeCents: [
      { day: 1, cents: 0 },
      { day: 6, cents: 30000 },
      { day: 12, cents: 60672 },
    ],
    planEndCents: 150000,
    todayFraction: 12 / 31,
    projectedCents: 184700,
  };

  it("puts day one on the axis and the last day at the right edge", () => {
    const geometry = buildBurnGeometry(figures, 31, BURN_FRAME);
    expect(geometry.actual[0]?.x).toBe(BURN_FRAME.left);
    expect(geometry.planEnd.x).toBe(BURN_FRAME.right);
    expect(geometry.planEnd.y).toBe(BURN_FRAME.topY);
    expect(geometry.today?.day).toBe(12);
  });

  it("scales against the plan, so an over-plan projection sits above the top gridline", () => {
    const geometry = buildBurnGeometry(figures, 31, BURN_FRAME);
    expect(geometry.axisMaxCents).toBe(150000);
    expect(geometry.projection?.y).toBeLessThan(BURN_FRAME.topY);
    expect(geometry.projection?.y).toBeGreaterThanOrEqual(2);
  });

  it("drops the projection once the month has run out of days to project into", () => {
    const finished = { ...figures, cumulativeCents: [{ day: 31, cents: 100000 }] };
    expect(buildBurnGeometry(finished, 31, BURN_FRAME).projection).toBeNull();
  });

  it("falls back to a round axis when no budget is in force", () => {
    const noPlan = { ...figures, planEndCents: 0 };
    expect(buildBurnGeometry(noPlan, 31, BURN_FRAME).axisMaxCents).toBe(80000);
  });
});

describe("buildStackedBars", () => {
  it("scales the tallest month to the full box and keeps a small segment visible", () => {
    const bars = buildStackedBars(
      [
        { month: "2026-07", total: 20000, segments: [{ categoryId: "a", cents: 20000 }] },
        {
          month: "2026-08",
          total: 10010,
          segments: [
            { categoryId: "a", cents: 10000 },
            { categoryId: "b", cents: 10 },
          ],
        },
      ],
      150,
    );

    expect(bars[0]?.segments[0]?.heightPx).toBe(150);
    expect(bars[1]?.segments[0]?.heightPx).toBe(75);
    expect(bars[1]?.segments[1]?.heightPx).toBe(2);
  });

  it("draws nothing at all when every month is empty", () => {
    const bars = buildStackedBars([{ month: "2026-08", total: 0, segments: [] }], 150);
    expect(bars[0]?.segments).toEqual([]);
  });
});

describe("toPolylinePoints", () => {
  it("emits one decimal per coordinate", () => {
    expect(toPolylinePoints([{ x: 1.234, y: 5 }])).toBe("1.2,5.0");
  });
});
