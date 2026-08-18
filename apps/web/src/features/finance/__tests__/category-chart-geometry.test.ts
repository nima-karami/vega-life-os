import { describe, expect, it } from "vitest";
import { buildCategoryChart } from "../category-chart-geometry";
import type { CategoryMonthFigures } from "../category-detail-figures";

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
