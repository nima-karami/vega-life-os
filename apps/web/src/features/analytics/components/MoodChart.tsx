import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { cx, useAnyCoarsePointer, useCompact } from "@/core/ui";
import { MOOD_LABEL } from "@/features/journal/model";
import { CHART_PRIMARY } from "../chart-constants";
import {
  axisTicks,
  buildMoodFootnote,
  buildMoodSummary,
  buildSegments,
  clampTooltipLeft,
  describePoint,
  findNearestLoggedIso,
  type Granularity,
  moodToTopPercent,
} from "../mood-chart-geometry";
import type { MoodPoint } from "../selectors";
import { MoodPointLink, type SelectionSource } from "./MoodPointLink";

const PLOT_HEIGHT = 132;
/** Keeps an edge tooltip inside the panel, since `main` is overflow-x-hidden. */
const TOOLTIP_EDGE_PERCENT = 25;

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
    source: SelectionSource;
  } | null>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const pointerTypeRef = useRef("");
  const step = series.length > 1 ? 100 / (series.length - 1) : 0;
  const rangeKey = `${granularity}:${series.length}:${series[0]?.iso ?? ""}`;
  const activeIso = selection?.rangeKey === rangeKey ? selection.iso : null;
  const isTapSelection = activeIso != null && selection?.source === "tap";
  const selectIso = (iso: string, source: SelectionSource) =>
    setSelection({ rangeKey, iso, source });
  // A second tap moves focus onto the occluding neighbour, so a tap must outlive blur.
  const clearHoverSelection = () => {
    if (selection?.source === "hover") setSelection(null);
  };
  const segments = buildSegments(series, step);
  const logged = series.filter((d) => d.mood != null);
  const active = series.find((d) => d.iso === activeIso && d.mood != null);
  const activeIndex = active ? series.indexOf(active) : -1;
  const summary = buildMoodSummary(logged, series.length, granularity);

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
                <MoodPointLink
                  key={day.iso}
                  day={{ ...day, mood: day.mood }}
                  index={i}
                  step={step}
                  compact={compact}
                  granularity={granularity}
                  activeIso={activeIso}
                  isTapSelection={isTapSelection}
                  isActive={active?.iso === day.iso}
                  hasActive={active != null}
                  pointerTypeRef={pointerTypeRef}
                  resolveIsoAt={resolveIsoAt}
                  onSelect={selectIso}
                  onClearHover={clearHoverSelection}
                  onPointClick={handlePointClick}
                />
              ),
            )}

            {active && activeIndex >= 0 && (
              <MoodTooltip
                point={active}
                granularity={granularity}
                compact={compact}
                leftPercent={clampTooltipLeft(activeIndex * step, TOOLTIP_EDGE_PERCENT)}
              />
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
        {buildMoodFootnote(logged.length, granularity, anyCoarsePointer)}
      </p>
    </div>
  );
}

function MoodTooltip({
  point,
  granularity,
  compact,
  leftPercent,
}: {
  point: MoodPoint;
  granularity: Granularity;
  compact: boolean;
  leftPercent: number;
}) {
  return (
    <div
      data-testid="mood-tooltip"
      className={cx(
        "pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border border-border bg-surface px-2 py-1 text-xs text-foreground shadow-sm",
        !compact && "whitespace-nowrap",
      )}
      style={{
        left: `${leftPercent}%`,
        top: `calc(${moodToTopPercent(point.mood ?? 1)}% - 10px)`,
        maxWidth: compact ? "50%" : undefined,
      }}
    >
      {describePoint(point, granularity)}
    </div>
  );
}
