/**
 * Pure task partitioning for the calendar.
 *
 * - timed:        date === day && time != null  → placed in the timed grid
 * - untimed:      date === day && time == null   → the per-day all-day row
 * - unscheduled:  date === null                  → the collapsible backlog rail
 *
 * These mirror the spec's "placed on grid iff time != null && date == visibleDay"
 * rule and keep the view free of filtering logic.
 */
import type { CalendarEvent } from "@vega/shared";
import type { Task } from "@/features/tasks";

/** Timed tasks for a given ISO day (rendered as positioned chips). */
export function getTimedTasksForDay(tasks: Task[], dayIso: string): Task[] {
  return tasks.filter((t) => t.time != null && t.date === dayIso);
}

/**
 * Dated-but-untimed ONE-OFF tasks for a given ISO day (the all-day row).
 * Anytime-habit instances (kind "habit", time null) are excluded — they live in
 * Today's Daily-habits strip, not the calendar.
 */
export function getUntimedTasksForDay(tasks: Task[], dayIso: string): Task[] {
  return tasks.filter((t) => t.date === dayIso && t.time == null && t.kind !== "habit");
}

/** Backlog tasks with no date, ordered by their `order` field. */
export function getUnscheduledTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => t.date === null).sort((a, b) => a.order - b.order);
}

/**
 * A multi-day span belongs in the all-day row, not the timed grid: an all-day event
 * covering >1 day, or a timed block lasting ≥24h. A short timed block that merely
 * crosses midnight stays a single-day timed chip on its start day.
 */
function isMultiDay(e: CalendarEvent): boolean {
  if (e.endDate == null || e.date == null || e.endDate === e.date) return false;
  return e.time == null || e.durationMin >= 1440;
}

function coversDay(e: CalendarEvent, dayIso: string): boolean {
  if (e.date == null) return false;
  const end = e.endDate ?? e.date;
  return e.date <= dayIso && dayIso <= end;
}

/** Timed lived (Google) events for a given ISO day — placed on the timed grid. */
export function getTimedLivedForDay(events: CalendarEvent[], dayIso: string): CalendarEvent[] {
  return events.filter((e) => e.time != null && !isMultiDay(e) && e.date === dayIso);
}

/** All-day + multi-day lived (Google) events covering a given ISO day — the all-day row. */
export function getAllDayLivedForDay(events: CalendarEvent[], dayIso: string): CalendarEvent[] {
  return events.filter((e) => (e.time == null || isMultiDay(e)) && coversDay(e, dayIso));
}

/** Single-day all-day lived events for a day — the per-day cells (multi-day go in bars). */
export function getSingleDayAllDayLived(events: CalendarEvent[], dayIso: string): CalendarEvent[] {
  return events.filter((e) => e.time == null && !isMultiDay(e) && e.date === dayIso);
}

/** One multi-day event drawn as a continuous bar across the visible day columns. */
export interface SpanBar {
  event: CalendarEvent;
  startCol: number; // 0-based column where the bar starts (clamped to the visible range)
  span: number; // number of columns it covers (≥ 1)
  lane: number; // vertical lane, so overlapping spans stack instead of colliding
  continuesLeft: boolean; // the event began before the first visible day
  continuesRight: boolean; // the event ends after the last visible day
}

/**
 * Lay out multi-day spans as continuous bars over `dayIsos` (the visible week, or a
 * single day on mobile), packing them into lanes so overlapping spans stack. Pure;
 * the view maps each bar to a CSS grid-column span + row.
 */
export function layoutSpanBars(
  events: CalendarEvent[],
  dayIsos: string[],
): { bars: SpanBar[]; lanes: number } {
  if (dayIsos.length === 0) return { bars: [], lanes: 0 };
  const first = dayIsos[0];
  const last = dayIsos[dayIsos.length - 1];
  const endOf = (e: CalendarEvent) => e.endDate ?? (e.date as string);

  const spans = events
    .filter((e) => isMultiDay(e) && e.date != null && e.date <= last && endOf(e) >= first)
    .sort((a, b) =>
      a.date === b.date
        ? endOf(b) < endOf(a)
          ? -1
          : 1
        : (a.date as string) < (b.date as string)
          ? -1
          : 1,
    );

  const laneEnd: number[] = []; // last column occupied per lane
  const bars: SpanBar[] = spans.map((e) => {
    const start = e.date as string;
    const end = endOf(e);
    const startCol = start <= first ? 0 : dayIsos.indexOf(start);
    const endCol = end >= last ? dayIsos.length - 1 : dayIsos.indexOf(end);
    const span = Math.max(1, endCol - startCol + 1);
    let lane = laneEnd.findIndex((c) => c < startCol);
    if (lane === -1) lane = laneEnd.length;
    laneEnd[lane] = endCol;
    return {
      event: e,
      startCol,
      span,
      lane,
      continuesLeft: start < first,
      continuesRight: end > last,
    };
  });

  return { bars, lanes: laneEnd.length };
}
