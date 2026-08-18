import { describe, expect, it } from "vitest";
import { buildCategoryChart, computeConcentrationBarFraction } from "../category-chart-geometry";
import type { CategoryMonthFigures } from "../category-detail-figures";

describe("the concentration bar fraction", () => {
  it("scales against the leader", () => {
    expect(computeConcentrationBarFraction(2500, 5000)).toBe(0.5);
    expect(computeConcentrationBarFraction(5000, 5000)).toBe(1);
  });

  it("reads as empty rather than dividing by zero when there is no leader", () => {
    expect(computeConcentrationBarFraction(0, 0)).toBe(0);
  });
});

const month = (
  key: string,
  spentCents: number,
  budgetCents: number,
  flag: CategoryMonthFigures["flag"],
): CategoryMonthFigures => ({ month: key, spentCents, budgetCents, flag });

describe("the twelve-month bar geometry", () => {
  const series = [
    month("2026-01", 10000, 18000, "under"),
    month("2026-02", 20000, 18000, "over"),
    month("2026-03", 5000, 18000, "current-partial"),
  ];

  it("bottoms every bar on the baseline and scales them against a round axis top", () => {
    const chart = buildCategoryChart(series, 18000);
    expect(chart.axisMaxCents).toBe(20000);
    for (const bar of chart.bars) expect(bar.y + bar.height).toBeCloseTo(chart.baselineY);
    expect(chart.bars[1].y).toBeCloseTo(chart.topY);
  });

  it("marks the breach and the month still running, and leaves the rest plain", () => {
    const chart = buildCategoryChart(series, 18000);
    expect(chart.bars.map((bar) => [bar.isBreach, bar.isCurrent])).toEqual([
      [false, false],
      [true, false],
      [false, true],
    ]);
  });

  it("reads a current month past its budget as a breach even while it is still running", () => {
    const chart = buildCategoryChart([month("2026-03", 30000, 18000, "current-partial")], 18000);
    expect(chart.bars[0]).toMatchObject({ isBreach: true, isCurrent: true });
  });

  it("draws no budget line when nothing is in force", () => {
    expect(buildCategoryChart(series, null).budgetY).toBeNull();
    expect(buildCategoryChart(series, 0).budgetY).toBeNull();
  });

  it("stays finite on an empty series, so an axis can still be drawn", () => {
    const chart = buildCategoryChart([], null);
    expect(chart.bars).toEqual([]);
    expect(chart.axisMaxCents).toBeGreaterThan(0);
    expect(Number.isFinite(chart.midCents)).toBe(true);
  });

  it("tops the axis at or above the tallest month, never below it", () => {
    const chart = buildCategoryChart([month("2026-01", 123456, 0, "over")], null);
    expect(chart.axisMaxCents).toBeGreaterThanOrEqual(123456);
    expect(chart.bars[0].y).toBeGreaterThanOrEqual(chart.topY);
  });

  it("keeps the bars inside the plot however many months are asked for", () => {
    const many = Array.from({ length: 36 }, (_, index) =>
      month(`2024-${String((index % 12) + 1).padStart(2, "0")}`, 1000 * index, 18000, "under"),
    );
    const chart = buildCategoryChart(many, 18000);
    const first = chart.bars[0];
    const last = chart.bars.at(-1);
    expect(first.x).toBeGreaterThanOrEqual(chart.axisLeft);
    expect((last?.x ?? 0) + (last?.width ?? 0)).toBeLessThanOrEqual(chart.axisRight);
    expect(first.width).toBeGreaterThanOrEqual(6);
  });
});
