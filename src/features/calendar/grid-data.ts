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
import type { CalendarEvent } from "@/features/calendar-sync/events-model";
import type { Task } from "@/features/tasks";

/** Timed tasks for a given ISO day (rendered as positioned chips). */
export function timedTasksForDay(tasks: Task[], dayIso: string): Task[] {
  return tasks.filter((t) => t.time != null && t.date === dayIso);
}

/**
 * Dated-but-untimed ONE-OFF tasks for a given ISO day (the all-day row).
 * Anytime-habit instances (kind "habit", time null) are excluded — they live in
 * Today's Daily-habits strip, not the calendar.
 */
export function untimedTasksForDay(tasks: Task[], dayIso: string): Task[] {
  return tasks.filter((t) => t.date === dayIso && t.time == null && t.kind !== "habit");
}

/** Backlog tasks with no date, ordered by their `order` field. */
export function unscheduledTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => t.date === null).sort((a, b) => a.order - b.order);
}

/** Timed lived (Google) events for a given ISO day — placed on the timed grid. */
export function timedLivedForDay(events: CalendarEvent[], dayIso: string): CalendarEvent[] {
  return events.filter((e) => e.date === dayIso && e.time != null);
}

/** All-day lived (Google) events for a given ISO day — the all-day row. */
export function allDayLivedForDay(events: CalendarEvent[], dayIso: string): CalendarEvent[] {
  return events.filter((e) => e.date === dayIso && e.time == null);
}
