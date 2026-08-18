import type { CategoryMonthFigures } from "./category-detail-figures";
import { chooseAxisMax } from "./overview/chart-geometry";

export const CATEGORY_CHART_VIEWBOX = "0 0 720 220";

const AXIS_LEFT = 54;
const AXIS_RIGHT = 700;
const PLOT_LEFT = 66;
const PLOT_RIGHT = 690;
const BASELINE_Y = 180;
const TOP_Y = 60;
const MID_Y = 120;
const MAX_BAR_WIDTH = 30;
const MIN_BAR_WIDTH = 6;

export interface CategoryBar {
  month: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Judged against the budget that month answered to, not the one in force today. */
  isBreach: boolean;
  isCurrent: boolean;
  centerX: number;
}

export interface CategoryChartGeometry {
  bars: CategoryBar[];
  axisMaxCents: number;
  midCents: number;
  axisLeft: number;
  axisRight: number;
  baselineY: number;
  midY: number;
  topY: number;
  /** Null when no budget is in force — there is no line to draw and the caption says so. */
  budgetY: number | null;
}

/**
 * Twelve (or six, or every) month against the budget line, in viewBox units. A month still running
 * keeps its own colour at reduced opacity — the caller draws that; the geometry only says which.
 */
/** How far a concentration row's bar fills against the leader — 0 while there is no leader at all. */
export function computeConcentrationBarFraction(cents: number, leaderCents: number): number {
  return leaderCents > 0 ? cents / leaderCents : 0;
}

export function buildCategoryChart(
  series: CategoryMonthFigures[],
  budgetCents: number | null,
): CategoryChartGeometry {
  const peak = series.reduce((highest, entry) => Math.max(highest, entry.spentCents), 0);
  const axisMaxCents = chooseAxisMax(Math.max(peak, budgetCents ?? 0));
  const span = BASELINE_Y - TOP_Y;
  const placeCents = (cents: number) => BASELINE_Y - (cents / axisMaxCents) * span;

  const slot = series.length > 0 ? (PLOT_RIGHT - PLOT_LEFT) / series.length : 0;
  const width = Math.min(MAX_BAR_WIDTH, Math.max(MIN_BAR_WIDTH, slot * 0.6));

  return {
    axisMaxCents,
    midCents: Math.round(axisMaxCents / 2),
    axisLeft: AXIS_LEFT,
    axisRight: AXIS_RIGHT,
    baselineY: BASELINE_Y,
    midY: MID_Y,
    topY: TOP_Y,
    budgetY: budgetCents === null || budgetCents <= 0 ? null : placeCents(budgetCents),
    bars: series.map((entry, index) => {
      const x = PLOT_LEFT + slot * index + (slot - width) / 2;
      const y = placeCents(entry.spentCents);
      return {
        month: entry.month,
        x,
        y,
        width,
        height: Math.max(BASELINE_Y - y, 0),
        isBreach:
          entry.flag === "over" ||
          (entry.flag === "current-partial" &&
            entry.budgetCents !== null &&
            entry.spentCents > entry.budgetCents),
        isCurrent: entry.flag === "current-partial",
        centerX: x + width / 2,
      };
    }),
  };
}
