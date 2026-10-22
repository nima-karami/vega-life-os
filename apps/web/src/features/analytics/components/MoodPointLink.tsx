import type { CSSProperties, MouseEvent, PointerEvent, RefObject } from "react";
import { Link } from "react-router";
import { cx } from "@/core/ui";
import { CHART_PRIMARY } from "../chart-constants";
import { describePoint, type Granularity, moodToTopPercent } from "../mood-chart-geometry";
import type { MoodPoint } from "../selectors";

/** Narrowest comfortable finger column, per D-C5-1. */
const MIN_HIT_WIDTH_PX = 24;

export type SelectionSource = "tap" | "hover";

interface MoodPointLinkProps {
  day: MoodPoint & { mood: number };
  index: number;
  step: number;
  compact: boolean;
  granularity: Granularity;
  activeIso: string | null;
  isTapSelection: boolean;
  isActive: boolean;
  hasActive: boolean;
  pointerTypeRef: RefObject<string>;
  resolveIsoAt: (clientX: number) => string | null;
  onSelect: (iso: string, source: SelectionSource) => void;
  onClearHover: () => void;
  onPointClick: (e: MouseEvent, iso: string) => void;
}

function hitStyle(compact: boolean, index: number, step: number, mood: number): CSSProperties {
  const left = `${index * step}%`;
  if (!compact) return { left, top: `${moodToTopPercent(mood)}%` };
  return {
    left,
    top: 0,
    height: "100%",
    width: `max(${step}%, ${MIN_HIT_WIDTH_PX}px)`,
    WebkitTapHighlightColor: "transparent",
  };
}

const HIT_CLASS_COMPACT = "touch-manipulation";
const HIT_CLASS_FINE =
  "-translate-y-1/2 rounded-full ring-offset-2 ring-offset-surface focus-visible:ring-2 focus-visible:ring-accent";
const DOT_CLASS_COMPACT =
  "absolute left-1/2 -translate-x-1/2 -translate-y-1/2 ring-offset-2 ring-offset-surface group-focus-visible:ring-2 group-focus-visible:ring-accent";
const DOT_CLASS_FINE = "hover:scale-125";

function dotOpacity(hasActive: boolean, isActive: boolean): number {
  return hasActive && !isActive ? 0.45 : 1;
}

export function MoodPointLink({
  day,
  index,
  step,
  compact,
  granularity,
  activeIso,
  isTapSelection,
  isActive,
  hasActive,
  pointerTypeRef,
  resolveIsoAt,
  onSelect,
  onClearHover,
  onPointClick,
}: MoodPointLinkProps) {
  const handlePointerEnter = (e: PointerEvent) => {
    if (e.pointerType === "touch") return;
    onSelect((compact ? resolveIsoAt(e.clientX) : null) ?? day.iso, "hover");
  };

  // Columns overlap, so the resolution boundary sits inside one element.
  const handlePointerMove = (e: PointerEvent) => {
    if (!compact || e.pointerType === "touch") return;
    const resolved = resolveIsoAt(e.clientX);
    if (resolved && resolved !== activeIso && !isTapSelection) onSelect(resolved, "hover");
  };

  // A tap focuses the link before its click, which would read as a second tap.
  const handleFocus = (e: { currentTarget: HTMLElement }) => {
    if (activeIso !== day.iso && e.currentTarget.matches(":focus-visible")) {
      onSelect(day.iso, "hover");
    }
  };

  return (
    <Link
      to={`/journal/${day.iso}`}
      data-iso={day.iso}
      aria-label={`${describePoint(day, granularity)}. Open journal.`}
      onPointerDown={(e) => {
        pointerTypeRef.current = e.pointerType;
      }}
      onPointerEnter={handlePointerEnter}
      onPointerMove={handlePointerMove}
      onPointerLeave={(e) => {
        if (e.pointerType !== "touch") onClearHover();
      }}
      onFocus={handleFocus}
      onBlur={onClearHover}
      onClick={(e) => onPointClick(e, day.iso)}
      className={cx(
        "group absolute -translate-x-1/2 outline-none",
        compact ? HIT_CLASS_COMPACT : HIT_CLASS_FINE,
      )}
      style={hitStyle(compact, index, step, day.mood)}
    >
      <span
        className={cx(
          "block rounded-full border-2 border-surface transition-transform",
          compact ? DOT_CLASS_COMPACT : DOT_CLASS_FINE,
          isActive && "scale-125",
        )}
        style={{
          width: 10,
          height: 10,
          background: CHART_PRIMARY,
          opacity: dotOpacity(hasActive, isActive),
          ...(compact ? { top: `${moodToTopPercent(day.mood)}%` } : null),
        }}
      />
    </Link>
  );
}
