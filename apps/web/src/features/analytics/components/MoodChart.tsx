import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { DOW, dowIndex } from "@/core/lib/date";
import { cx, useAnyCoarsePointer, useCompact } from "@/core/ui";
import { MOOD_LABEL } from "@/features/journal/model";
import { CHART_PRIMARY } from "../chart-constants";
import type { MoodPoint } from "../selectors";

const PLOT_HEIGHT = 132;
/** Narrowest comfortable finger column, per D-C5-1. */
const MIN_HIT_WIDTH_PX = 24;
/** Keeps an edge tooltip inside the panel, since `main` is overflow-x-hidden. */
const TOOLTIP_EDGE_PERCENT = 25;

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

/** The logged point whose plotted centre is closest to `percent` across the plot. */
function findNearestLoggedIso(series: MoodPoint[], step: number, percent: number): string | null {
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
  const compact = useCompact();
  const anyCoarsePointer = useAnyCoarsePointer();
  const navigate = useNavigate();
  // Tagged with the range it was picked in, so switching range drops it without an effect.
  const [selection, setSelection] = useState<{
    rangeKey: string;
    iso: string;
    source: "tap" | "hover";
  } | null>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const pointerTypeRef = useRef("");
  const step = series.length > 1 ? 100 / (series.length - 1) : 0;
  const rangeKey = `${granularity}:${series.length}:${series[0]?.iso ?? ""}`;
  const activeIso = selection?.rangeKey === rangeKey ? selection.iso : null;
  const isTapSelection = activeIso != null && selection?.source === "tap";
  const selectIso = (iso: string, source: "tap" | "hover") =>
    setSelection({ rangeKey, iso, source });
  // A second tap moves focus onto the occluding neighbour, so a tap must outlive blur.
  const clearHoverSelection = () => {
    if (selection?.source === "hover") setSelection(null);
  };
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

  // Dismissing on a press inside the plot would run before the click and eat the second tap.
  useEffect(() => {
    if (activeIso == null) return;
    const onDown = (e: PointerEvent) => {
      if (plotRef.current?.contains(e.target as Node)) return;
      setSelection(null);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [activeIso]);

  // Overlapping hit columns make the receiving element meaningless, so compact resolves by x.
  const resolveIsoAt = (clientX: number) => {
    const rect = plotRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return null;
    return findNearestLoggedIso(series, step, ((clientX - rect.left) / rect.width) * 100);
  };

  const handlePointClick = (e: React.MouseEvent, iso: string) => {
    if (e.detail === 0) return;
    const resolved = (compact ? resolveIsoAt(e.clientX) : iso) ?? iso;
    if (pointerTypeRef.current === "touch" && resolved !== activeIso) {
      e.preventDefault();
      selectIso(resolved, "tap");
      plotRef.current?.querySelector<HTMLElement>(`[data-iso="${resolved}"]`)?.focus();
      return;
    }
    if (resolved !== iso) {
      e.preventDefault();
      navigate(`/journal/${resolved}`);
    }
  };

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
          <div ref={plotRef} className="relative min-w-0" style={{ height: PLOT_HEIGHT }}>
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
                  data-iso={day.iso}
                  aria-label={`${describePoint(day, granularity)}. Open journal.`}
                  onPointerDown={(e) => {
                    pointerTypeRef.current = e.pointerType;
                  }}
                  onPointerEnter={(e) => {
                    if (e.pointerType === "touch") return;
                    selectIso((compact ? resolveIsoAt(e.clientX) : null) ?? day.iso, "hover");
                  }}
                  onPointerMove={(e) => {
                    // Columns overlap, so the resolution boundary sits inside one element.
                    if (!compact || e.pointerType === "touch") return;
                    const resolved = resolveIsoAt(e.clientX);
                    if (resolved && resolved !== activeIso && !isTapSelection)
                      selectIso(resolved, "hover");
                  }}
                  onPointerLeave={(e) => {
                    if (e.pointerType !== "touch") clearHoverSelection();
                  }}
                  onFocus={(e) => {
                    // A tap focuses the link before its click, which would read as a second tap.
                    if (activeIso !== day.iso && e.currentTarget.matches(":focus-visible"))
                      selectIso(day.iso, "hover");
                  }}
                  onBlur={clearHoverSelection}
                  onClick={(e) => handlePointClick(e, day.iso)}
                  className={cx(
                    "group absolute -translate-x-1/2 outline-none",
                    compact
                      ? "touch-manipulation"
                      : "-translate-y-1/2 rounded-full ring-offset-2 ring-offset-surface focus-visible:ring-2 focus-visible:ring-accent",
                  )}
                  style={
                    compact
                      ? {
                          left: `${i * step}%`,
                          top: 0,
                          height: "100%",
                          width: `max(${step}%, ${MIN_HIT_WIDTH_PX}px)`,
                          WebkitTapHighlightColor: "transparent",
                        }
                      : { left: `${i * step}%`, top: `${(1 - moodToUnit(day.mood)) * 100}%` }
                  }
                >
                  <span
                    className={cx(
                      "block rounded-full border-2 border-surface transition-transform",
                      compact
                        ? "absolute left-1/2 -translate-x-1/2 -translate-y-1/2 ring-offset-2 ring-offset-surface group-focus-visible:ring-2 group-focus-visible:ring-accent"
                        : "hover:scale-125",
                      active?.iso === day.iso && "scale-125",
                    )}
                    style={{
                      width: 10,
                      height: 10,
                      background: CHART_PRIMARY,
                      opacity: active && active.iso !== day.iso ? 0.45 : 1,
                      ...(compact ? { top: `${(1 - moodToUnit(day.mood)) * 100}%` } : null),
                    }}
                  />
                </Link>
              ),
            )}

            {active && activeIndex >= 0 && (
              <div
                data-testid="mood-tooltip"
                className={cx(
                  "pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border border-border bg-surface px-2 py-1 text-xs text-foreground shadow-sm",
                  !compact && "whitespace-nowrap",
                )}
                style={{
                  left: `${Math.min(
                    100 - TOOLTIP_EDGE_PERCENT,
                    Math.max(TOOLTIP_EDGE_PERCENT, activeIndex * step),
                  )}%`,
                  top: `calc(${(1 - moodToUnit(active.mood ?? 1)) * 100}% - 10px)`,
                  maxWidth: compact ? "50%" : undefined,
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
          : `${logged.length} ${granularity === "week" ? "week" : "day"}${logged.length === 1 ? "" : "s"} logged: ${anyCoarsePointer ? "tap a point to see the day, tap again to open its journal" : "tap a point to open that day's journal"}. Gaps are unrecorded ${granularity === "week" ? "weeks" : "days"}.`}
      </p>
    </div>
  );
}
