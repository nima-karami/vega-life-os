import { useState } from "react";
import { Link } from "react-router-dom";
import { DOW, dowIndex } from "@/core/lib/date";
import { MOOD_LABEL } from "@/features/journal/model";
import { CHART_PRIMARY } from "../chart-constants";
import type { MoodPoint } from "../selectors";

const PLOT_HEIGHT = 132;

type Granularity = "day" | "week";

/** 0 (bottom, mood 1) .. 1 (top, mood 5); accepts fractional weekly averages. */
const moodToUnit = (mood: number) => (mood - 1) / 4;
const moodLabelOf = (mood: number) => MOOD_LABEL[Math.max(1, Math.min(5, Math.round(mood)))];

function describePoint(point: MoodPoint, granularity: Granularity): string {
  if (point.mood == null) return point.label;
  const label = moodLabelOf(point.mood);
  if (granularity === "week") return `Week of ${point.label} · ${label}`;
  return `${point.label} · ${DOW[dowIndex(point.iso)]} · ${label}`;
}

interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function buildSegments(series: MoodPoint[], step: number): Segment[] {
  const segments: Segment[] = [];
  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1];
    const curr = series[i];
    if (prev.mood == null || curr.mood == null) continue;
    segments.push({
      x1: (i - 1) * step,
      y1: (1 - moodToUnit(prev.mood)) * 100,
      x2: i * step,
      y2: (1 - moodToUnit(curr.mood)) * 100,
    });
  }
  return segments;
}

/** Evenly sample up to `count` axis labels from the series (always first + last). */
function axisTicks(series: MoodPoint[], count = 5): { key: string; label: string }[] {
  if (series.length <= count) return series.map((d) => ({ key: d.iso, label: d.label }));
  const stepIndex = (series.length - 1) / (count - 1);
  return Array.from({ length: count }, (_, i) => {
    const d = series[Math.round(i * stepIndex)];
    return { key: d.iso, label: d.label };
  });
}

/** Mood over time on a real date axis. Logged days are focusable links into that
 *  day's journal; gaps stay gaps (never plotted as 0). A hover/focus tooltip names
 *  the date, weekday, and mood. */
export function MoodChart({
  series,
  granularity = "day",
}: {
  series: MoodPoint[];
  granularity?: Granularity;
}) {
  const [activeIso, setActiveIso] = useState<string | null>(null);
  const step = series.length > 1 ? 100 / (series.length - 1) : 0;
  const segments = buildSegments(series, step);
  const logged = series.filter((d) => d.mood != null);
  const active = series.find((d) => d.iso === activeIso && d.mood != null);
  const activeIndex = active ? series.indexOf(active) : -1;
  const average = logged.length
    ? logged.reduce((sum, d) => sum + (d.mood ?? 0), 0) / logged.length
    : 0;

  const summary = logged.length
    ? `Mood over ${granularity === "week" ? "the year, by week" : `the last ${series.length} days`}: ${logged.length} logged, averaging ${moodLabelOf(average)}.`
    : "No mood logged in this range.";

  return (
    <div className="mt-4">
      <div className="flex gap-3">
        <div
          className="flex shrink-0 flex-col justify-between text-[10px] text-muted"
          style={{ height: PLOT_HEIGHT }}
          aria-hidden="true"
        >
          <span>{MOOD_LABEL[5]}</span>
          <span>{MOOD_LABEL[3]}</span>
          <span>{MOOD_LABEL[1]}</span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="sr-only">{summary}</p>
          <div className="relative min-w-0" style={{ height: PLOT_HEIGHT }}>
            <svg
              className="absolute inset-0 h-full w-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <line
                x1="0"
                y1="50"
                x2="100"
                y2="50"
                stroke="var(--color-line-soft)"
                strokeWidth={0.5}
                vectorEffect="non-scaling-stroke"
                strokeDasharray="2 3"
              />
              {segments.map((s) => (
                <line
                  key={`${s.x1}-${s.y1}`}
                  x1={s.x1}
                  y1={s.y1}
                  x2={s.x2}
                  y2={s.y2}
                  stroke={CHART_PRIMARY}
                  strokeWidth={1.5}
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap="round"
                />
              ))}
            </svg>

            {series.map((day, i) =>
              day.mood == null ? null : (
                <Link
                  key={day.iso}
                  to={`/journal/${day.iso}`}
                  aria-label={`${describePoint(day, granularity)}. Open journal.`}
                  onMouseEnter={() => setActiveIso(day.iso)}
                  onMouseLeave={() => setActiveIso((cur) => (cur === day.iso ? null : cur))}
                  onFocus={() => setActiveIso(day.iso)}
                  onBlur={() => setActiveIso((cur) => (cur === day.iso ? null : cur))}
                  className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full outline-none ring-offset-2 ring-offset-surface focus-visible:ring-2 focus-visible:ring-accent"
                  style={{ left: `${i * step}%`, top: `${(1 - moodToUnit(day.mood)) * 100}%` }}
                >
                  <span
                    className="block rounded-full border-2 border-surface transition-transform hover:scale-125"
                    style={{
                      width: 10,
                      height: 10,
                      background: CHART_PRIMARY,
                      opacity: activeIso && activeIso !== day.iso ? 0.45 : 1,
                    }}
                  />
                </Link>
              ),
            )}

            {active && activeIndex >= 0 && (
              <div
                className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-border bg-surface px-2 py-1 text-xs text-foreground shadow-sm"
                style={{
                  left: `${activeIndex * step}%`,
                  top: `calc(${(1 - moodToUnit(active.mood ?? 1)) * 100}% - 10px)`,
                }}
              >
                {describePoint(active, granularity)}
              </div>
            )}
          </div>

          <div
            className="mt-2 flex justify-between text-[9px] tabular-nums text-muted"
            aria-hidden="true"
          >
            {axisTicks(series).map((t) => (
              <span key={t.key}>{t.label}</span>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted">
        {logged.length === 0
          ? "No mood logged in this range."
          : `${logged.length} ${granularity === "week" ? "week" : "day"}${logged.length === 1 ? "" : "s"} logged — tap a point to open that day's journal. Gaps are unrecorded ${granularity === "week" ? "weeks" : "days"}.`}
      </p>
    </div>
  );
}
