import type { CumulativeBurnFigures, StackedMonthColumn } from "../dashboard-charts";

/** Where a chart's axes sit inside its own viewBox — the one thing the two burn sizes differ on. */
export interface ChartFrame {
  left: number;
  right: number;
  baselineY: number;
  topY: number;
}

export const BURN_FRAME: ChartFrame = { left: 52, right: 480, baselineY: 150, topY: 20 };
export const MOBILE_BURN_FRAME: ChartFrame = { left: 6, right: 314, baselineY: 86, topY: 10 };

const TREND_FRAME: ChartFrame = { left: 42, right: 480, baselineY: 150, topY: 20 };
const TREND_PLOT_LEFT = 55;
const TREND_PLOT_RIGHT = 475;

const NICE_STEPS = [1, 1.2, 1.6, 2, 2.4, 3, 4, 5, 6, 8, 10];

/** A round axis top at or above the largest figure, so the middle gridline reads as a clean half. */
export function chooseAxisMax(cents: number): number {
  if (cents <= 0) return 100;
  const magnitude = 10 ** Math.floor(Math.log10(cents));
  for (const step of NICE_STEPS) {
    const candidate = Math.round(step * magnitude);
    if (candidate >= cents) return candidate;
  }
  return Math.round(10 * magnitude);
}

function projectValue(cents: number, axisMaxCents: number, frame: ChartFrame): number {
  const span = frame.baselineY - frame.topY;
  const raw = frame.baselineY - (cents / axisMaxCents) * span;
  // A figure past the plan still has to land inside the viewBox rather than off the top of it.
  return Math.max(raw, Math.max(2, frame.topY - 14));
}

export interface TrendSample {
  month: string;
  cents: number;
  budgetCents: number | null;
  /** The scoped month is still running, so its point is drawn hollow on a dashed leg. */
  isOpen: boolean;
}

export interface TrendPoint {
  month: string;
  x: number;
  y: number;
  cents: number;
  isBreach: boolean;
  isOpen: boolean;
}

export interface TrendGeometry {
  frame: ChartFrame;
  axisMaxCents: number;
  midCents: number;
  midY: number;
  points: TrendPoint[];
  /** Null when no budget is in force for the scoped month — nothing to draw a dashed line at. */
  budgetY: number | null;
  budgetCents: number | null;
}

/** One category's month-by-month spend against the budget in force, in viewBox units. */
export function buildTrendGeometry(samples: TrendSample[]): TrendGeometry {
  const scopedBudget = samples.at(-1)?.budgetCents ?? null;
  const peak = samples.reduce((highest, sample) => Math.max(highest, sample.cents), 0);
  const axisMaxCents = chooseAxisMax(Math.max(peak, scopedBudget ?? 0));
  const step = samples.length > 1 ? (TREND_PLOT_RIGHT - TREND_PLOT_LEFT) / (samples.length - 1) : 0;

  return {
    frame: TREND_FRAME,
    axisMaxCents,
    midCents: Math.round(axisMaxCents / 2),
    midY: projectValue(axisMaxCents / 2, axisMaxCents, TREND_FRAME),
    budgetCents: scopedBudget,
    budgetY: scopedBudget === null ? null : projectValue(scopedBudget, axisMaxCents, TREND_FRAME),
    points: samples.map((sample, index) => ({
      month: sample.month,
      x: TREND_PLOT_LEFT + step * index,
      y: projectValue(sample.cents, axisMaxCents, TREND_FRAME),
      cents: sample.cents,
      isBreach: !sample.isOpen && sample.budgetCents !== null && sample.cents > sample.budgetCents,
      isOpen: sample.isOpen,
    })),
  };
}

export interface BurnPoint {
  x: number;
  y: number;
}

export interface BurnGeometry {
  frame: ChartFrame;
  axisMaxCents: number;
  midCents: number;
  midY: number;
  actual: BurnPoint[];
  planEnd: BurnPoint;
  /** Null before the month has a single day of spend on file. */
  today: (BurnPoint & { day: number; cents: number }) | null;
  projection: BurnPoint | null;
}

/** Cumulative spend against the straight plan line, both in viewBox units. */
export function buildBurnGeometry(
  figures: CumulativeBurnFigures,
  daysInMonth: number,
  frame: ChartFrame,
): BurnGeometry {
  const lastCents = figures.cumulativeCents.at(-1)?.cents ?? 0;
  const axisMaxCents =
    figures.planEndCents > 0 ? figures.planEndCents : chooseAxisMax(Math.max(lastCents, 1));
  const span = daysInMonth > 1 ? daysInMonth - 1 : 1;
  const placeDay = (day: number) => frame.left + ((day - 1) / span) * (frame.right - frame.left);
  const placeCents = (cents: number) => projectValue(cents, axisMaxCents, frame);

  const actual = figures.cumulativeCents.map((entry) => ({
    x: placeDay(entry.day),
    y: placeCents(entry.cents),
  }));
  const lastDay = figures.cumulativeCents.at(-1)?.day ?? null;

  return {
    frame,
    axisMaxCents,
    midCents: Math.round(axisMaxCents / 2),
    midY: placeCents(axisMaxCents / 2),
    actual,
    planEnd: { x: placeDay(daysInMonth), y: placeCents(axisMaxCents) },
    today:
      lastDay === null
        ? null
        : { day: lastDay, cents: lastCents, x: placeDay(lastDay), y: placeCents(lastCents) },
    projection:
      lastDay === null || lastDay >= daysInMonth
        ? null
        : { x: placeDay(daysInMonth), y: placeCents(figures.projectedCents) },
  };
}

interface StackedBarSegment {
  categoryId: string;
  cents: number;
  heightPx: number;
}

export interface StackedBarColumn {
  month: string;
  total: number;
  segments: StackedBarSegment[];
}

const MIN_SEGMENT_PX = 2;

/** Pixel heights for the DOM stack — the tallest month fills the box, the rest scale against it. */
export function buildStackedBars(
  columns: StackedMonthColumn[],
  maxHeightPx: number,
): StackedBarColumn[] {
  const tallest = columns.reduce((highest, column) => Math.max(highest, column.total), 0);
  const scale = tallest > 0 ? maxHeightPx / tallest : 0;
  return columns.map((column) => ({
    month: column.month,
    total: column.total,
    segments: column.segments.map((segment) => ({
      categoryId: segment.categoryId,
      cents: segment.cents,
      heightPx: Math.max(segment.cents * scale, MIN_SEGMENT_PX),
    })),
  }));
}

export const toPolylinePoints = (points: BurnPoint[]): string =>
  points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
