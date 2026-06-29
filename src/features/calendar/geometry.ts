import { addDays, format, parseISO } from "date-fns";

/**
 * Pure grid geometry for the week calendar.
 *
 * All time math lives here so it can be unit-tested without a DOM. The React
 * view consumes these helpers; it owns no scheduling arithmetic of its own.
 *
 * Window, snap granularity, hour height and the minimum chip height are ports
 * of the legacy CalendarPage so the re-skin preserves the original behavior.
 */

/** Visible window: 05:00–23:00 (minutes since midnight). */
export const DAY_START = 5 * 60;
export const DAY_END = 23 * 60;
/** Pixels per hour of the timed grid. */
export const HOUR_PX = 46;
/** Width of the left hour gutter, px. */
export const GUTTER = 52;
/** Drag/click snap granularity, minutes. */
export const SNAP = 15;
/** Smallest visible chip height so very short tasks stay tappable. */
export const MIN_CHIP_PX = 20;

/** Hours rendered as gutter labels + horizontal lines (inclusive of END hour). */
export const HOURS = Array.from({ length: (DAY_END - DAY_START) / 60 + 1 }, (_, i) => 5 + i);

/** Round a minute value to the nearest SNAP step. */
export const snap = (m: number) => Math.round(m / SNAP) * SNAP;

/** Format minutes-since-midnight as "HH:mm". */
export const fmtMin = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Clamp a start minute so a chip stays inside the window with room for a slot. */
export const clampStart = (m: number) => Math.max(DAY_START, Math.min(DAY_END - SNAP, m));

/** Pixel offset from the window top for a start minute (clamped to the top edge). */
export const chipTop = (startMin: number) =>
  ((Math.max(DAY_START, startMin) - DAY_START) / 60) * HOUR_PX;

/** Pixel height for a duration, reserving a 2px gap and a minimum tappable size. */
export const chipHeight = (durationMin: number) =>
  Math.max((durationMin / 60) * HOUR_PX - 2, MIN_CHIP_PX);

/** True when a start minute falls outside the visible 05:00–23:00 window. */
export const isOffWindow = (startMin: number) => startMin < DAY_START || startMin > DAY_END;

/** Convert a pixel offset within the grid body into a snapped, clamped start minute. */
export const minuteAtOffset = (offsetPx: number) =>
  clampStart(snap(DAY_START + (offsetPx / HOUR_PX) * 60));

/** Fixed duration (minutes) given to an all-day task dropped onto the grid. */
export const DROP_DURATION = 60;

/**
 * Resolve an all-day → grid drop at a pixel offset into a scheduled block: the
 * snapped start clamped so a {@link DROP_DURATION} block ends by {@link DAY_END}.
 * The caller converts `startMin` to "HH:mm" via {@link fmtMin} and supplies the day.
 */
export const dropToSchedule = (offsetPx: number): { startMin: number; durationMin: number } => ({
  startMin: Math.max(DAY_START, Math.min(minuteAtOffset(offsetPx), DAY_END - DROP_DURATION)),
  durationMin: DROP_DURATION,
});

/** An axis-aligned pixel box, grid-content-relative (left/top/right/bottom). */
export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** A chip's pixel box tagged with its task id. */
export interface ChipBox extends Box {
  id: string;
}

/** Ids of chips whose pixel boxes intersect the marquee rect (all grid-content-relative). */
export function marqueeHits(rect: Box, boxes: ChipBox[]): string[] {
  return boxes
    .filter(
      (b) =>
        b.left < rect.right && b.right > rect.left && b.top < rect.bottom && b.bottom > rect.top,
    )
    .map((b) => b.id);
}

/** A timed selection member for a group move. */
export interface ShiftItem {
  id: string;
  /** ISO yyyy-mm-dd */
  date: string;
  start: number;
  durationMin: number;
}

/**
 * Shift each timed item by (dayDelta days, minDelta minutes), each clamped to the
 * window by **its own** duration (the same "move" rule {@link resolveDrag} uses).
 * All-day members are shifted by the caller (day-delta only, stay untimed).
 */
export function shiftSelection(
  items: ShiftItem[],
  dayDelta: number,
  minDelta: number,
): { id: string; date: string; start: number }[] {
  return items.map((it) => ({
    id: it.id,
    date: format(addDays(parseISO(it.date), dayDelta), "yyyy-MM-dd"),
    start: Math.max(DAY_START, Math.min(DAY_END - it.durationMin, it.start + minDelta)),
  }));
}

/** A timed item to lay out: id + start minute + duration. */
export interface LayoutSpan {
  id: string;
  start: number;
  durationMin: number;
}

/** A chip's horizontal slot: which column it sits in, out of how many. */
export interface ColumnSlot {
  col: number;
  cols: number;
}

/**
 * Side-by-side layout for overlapping timed chips (Google-Calendar style).
 * Items are grouped into clusters of transitively-overlapping spans; within a
 * cluster each span is greedily assigned the first free column, and every span
 * in the cluster shares that cluster's column count. Non-overlapping spans get
 * `{ col: 0, cols: 1 }` (full width). Pure — no DOM.
 */
export function layoutColumns(items: LayoutSpan[]): Record<string, ColumnSlot> {
  const spans = items
    .map((it) => ({ id: it.id, start: it.start, end: it.start + Math.max(it.durationMin, SNAP) }))
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const out: Record<string, ColumnSlot> = {};
  let cluster: typeof spans = [];
  let clusterEnd = Number.NEGATIVE_INFINITY;

  const flush = () => {
    const colEnds: number[] = []; // last end-minute occupying each column
    const colOf: Record<string, number> = {};
    for (const s of cluster) {
      let placed = colEnds.findIndex((end) => end <= s.start);
      if (placed === -1) {
        placed = colEnds.length;
        colEnds.push(s.end);
      } else {
        colEnds[placed] = s.end;
      }
      colOf[s.id] = placed;
    }
    for (const s of cluster) out[s.id] = { col: colOf[s.id], cols: colEnds.length };
    cluster = [];
    clusterEnd = Number.NEGATIVE_INFINITY;
  };

  for (const s of spans) {
    if (cluster.length && s.start >= clusterEnd) flush();
    cluster.push(s);
    clusterEnd = Math.max(clusterEnd, s.end);
  }
  if (cluster.length) flush();
  return out;
}

export type DragMode = "move" | "top" | "bottom";

export interface DragOrigin {
  origDate: string;
  origStart: number;
  origDur: number;
}

export interface DragPointer {
  /** Pointer position in minutes-since-midnight within the grid. */
  pointerMin: number;
  /** Offset from the block top to the pointer captured at grab time. */
  grabMin: number;
  /** Day column the pointer is currently over (used by "move"). */
  targetDate: string;
}

export interface DragResult {
  date: string;
  start: number;
  durationMin: number;
}

/**
 * Resolve a live drag into the next {date,start,durationMin}.
 * - move: reposition body to another day/time, duration fixed, fully clamped.
 * - bottom: extend/shrink the end; at least one SNAP slot tall.
 * - top: drag the start while holding the end fixed; at least one SNAP slot.
 */
export function resolveDrag(mode: DragMode, origin: DragOrigin, pointer: DragPointer): DragResult {
  const { origDate, origStart, origDur } = origin;
  const { pointerMin, grabMin, targetDate } = pointer;

  if (mode === "move") {
    let start = snap(pointerMin - grabMin);
    start = Math.max(DAY_START, Math.min(DAY_END - origDur, start));
    return { date: targetDate, start, durationMin: origDur };
  }

  if (mode === "bottom") {
    let end = snap(pointerMin);
    end = Math.max(origStart + SNAP, Math.min(DAY_END, end));
    return { date: origDate, start: origStart, durationMin: end - origStart };
  }

  // top
  let start = snap(pointerMin);
  start = Math.max(DAY_START, Math.min(origStart + origDur - SNAP, start));
  return { date: origDate, start, durationMin: origStart + origDur - start };
}
