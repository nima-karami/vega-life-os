import { Tooltip } from "@heroui/react";
import { MOOD_LABEL } from "@/features/journal/model";
import { CHART_PRIMARY } from "../chart-constants";
import type { MoodPoint, WeekdayMood } from "../selectors";

const PLOT_HEIGHT = 128;

/** 0 (bottom, mood 1) .. 1 (top, mood 5). */
const moodToUnit = (mood: number) => (mood - 1) / 4;

interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function buildSegments(series: MoodPoint[]): Segment[] {
  const step = series.length > 1 ? 100 / (series.length - 1) : 0;
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

/** Mood over time (gaps kept, never zeroed) plus a weekday-average companion so
 *  patterns like a Monday dip surface. */
export function MoodChart({
  series,
  byWeekday,
}: {
  series: MoodPoint[];
  byWeekday: WeekdayMood[];
}) {
  const segments = buildSegments(series);
  const step = series.length > 1 ? 100 / (series.length - 1) : 0;
  const loggedCount = series.filter((d) => d.mood != null).length;

  return (
    <div className="mt-4 grid gap-6 sm:grid-cols-[1fr_auto]">
      <div className="min-w-0">
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
          <div className="relative min-w-0 flex-1" style={{ height: PLOT_HEIGHT }}>
            <svg
              className="absolute inset-0 h-full w-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <title>Mood trend</title>
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
                <Tooltip key={day.iso}>
                  <Tooltip.Trigger
                    className="absolute -translate-x-1/2 -translate-y-1/2 cursor-default rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    style={{
                      left: `${i * step}%`,
                      top: `${(1 - moodToUnit(day.mood)) * 100}%`,
                    }}
                  >
                    <span
                      className="block rounded-full"
                      style={{ width: 8, height: 8, background: CHART_PRIMARY }}
                    />
                  </Tooltip.Trigger>
                  <Tooltip.Content className="text-xs">
                    {day.label} · {MOOD_LABEL[day.mood]}
                  </Tooltip.Content>
                </Tooltip>
              ),
            )}
          </div>
        </div>
        <p className="mt-3 text-xs text-muted">
          {loggedCount === 0
            ? "No mood logged in this range."
            : `${loggedCount} day${loggedCount === 1 ? "" : "s"} logged. Gaps are days you didn't record.`}
        </p>
      </div>

      <div>
        <p className="mb-3 text-xs font-medium text-muted">Average by weekday</p>
        <div className="flex items-end gap-1.5" style={{ height: PLOT_HEIGHT - 24 }}>
          {byWeekday.map((wd) => (
            <div key={wd.index} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex w-full flex-1 flex-col justify-end">
                <div
                  className="w-full rounded-t-[2px]"
                  style={{
                    height: wd.avg == null ? 0 : `${(moodToUnit(wd.avg) || 0.02) * 100}%`,
                    minHeight: wd.avg == null ? 0 : 2,
                    background: CHART_PRIMARY,
                    opacity: 0.7,
                  }}
                  title={
                    wd.avg == null
                      ? `${wd.label} · no data`
                      : `${wd.label} · ${wd.avg.toFixed(1)} avg`
                  }
                />
              </div>
              <span className="text-[9px] tabular-nums text-muted">
                {wd.avg?.toFixed(1) ?? "–"}
              </span>
              <span className="text-[9px] text-muted">{wd.label.slice(0, 1)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
