import { DOW, dowIndex } from "@/core/lib/date";
import { MOOD_LABEL } from "@/features/journal/model";
import type { MoodPoint } from "./selectors";

export type Granularity = "day" | "week";

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** 0 (bottom, mood 1) .. 1 (top, mood 5); accepts fractional weekly averages. */
const moodToUnit = (mood: number) => (mood - 1) / 4;

/** CSS percentage from the top of the plot. */
export const moodToTopPercent = (mood: number) => (1 - moodToUnit(mood)) * 100;

const moodLabelOf = (mood: number) => MOOD_LABEL[Math.max(1, Math.min(5, Math.round(mood)))];

export function describePoint(point: MoodPoint, granularity: Granularity): string {
  if (point.mood == null) return point.label;
  const label = moodLabelOf(point.mood);
  if (granularity === "week") return `Week of ${point.label} · ${label}`;
  return `${point.label} · ${DOW[dowIndex(point.iso)]} · ${label}`;
}

export function buildSegments(series: MoodPoint[], step: number): Segment[] {
  const segments: Segment[] = [];
  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1];
    const curr = series[i];
    if (prev.mood == null || curr.mood == null) continue;
    segments.push({
      x1: (i - 1) * step,
      y1: moodToTopPercent(prev.mood),
      x2: i * step,
      y2: moodToTopPercent(curr.mood),
    });
  }
  return segments;
}

/** The logged point whose plotted centre is closest to `percent` across the plot. */
export function findNearestLoggedIso(
  series: MoodPoint[],
  step: number,
  percent: number,
): string | null {
  let nearestIso: string | null = null;
  let nearestGap = Number.POSITIVE_INFINITY;
  for (let i = 0; i < series.length; i++) {
    const day = series[i];
    if (day.mood == null) continue;
    const gap = Math.abs(i * step - percent);
    if (gap < nearestGap) {
      nearestGap = gap;
      nearestIso = day.iso;
    }
  }
  return nearestIso;
}

/** Evenly sample up to `count` axis labels from the series (always first + last). */
export function axisTicks(series: MoodPoint[], count = 5): { key: string; label: string }[] {
  if (series.length <= count) return series.map((d) => ({ key: d.iso, label: d.label }));
  const stepIndex = (series.length - 1) / (count - 1);
  return Array.from({ length: count }, (_, i) => {
    const d = series[Math.round(i * stepIndex)];
    return { key: d.iso, label: d.label };
  });
}

export function averageMood(logged: MoodPoint[]): number {
  if (logged.length === 0) return 0;
  return logged.reduce((sum, d) => sum + (d.mood ?? 0), 0) / logged.length;
}

export function buildMoodSummary(
  logged: MoodPoint[],
  seriesLength: number,
  granularity: Granularity,
): string {
  if (logged.length === 0) return "No mood logged in this range.";
  const span = granularity === "week" ? "the year, by week" : `the last ${seriesLength} days`;
  return `Mood over ${span}: ${logged.length} logged, averaging ${moodLabelOf(averageMood(logged))}.`;
}

export function buildMoodFootnote(
  loggedCount: number,
  granularity: Granularity,
  anyCoarsePointer: boolean,
): string {
  if (loggedCount === 0) return "No mood logged in this range.";
  const unit = granularity === "week" ? "week" : "day";
  const plural = loggedCount === 1 ? "" : "s";
  const hint = anyCoarsePointer
    ? "tap a point to see the day, tap again to open its journal"
    : "tap a point to open that day's journal";
  return `${loggedCount} ${unit}${plural} logged: ${hint}. Gaps are unrecorded ${unit}s.`;
}

export function clampTooltipLeft(percent: number, edgePercent: number): number {
  return Math.min(100 - edgePercent, Math.max(edgePercent, percent));
}
