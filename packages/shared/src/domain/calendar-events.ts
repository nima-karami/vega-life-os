import type { CalendarEventCreate as CalendarEvent } from "../entities/calendar-event";

/**
 * A multi-day span belongs in the all-day row, not the timed grid: an all-day event
 * covering >1 day, or a timed block lasting ≥24h. A short timed block that merely
 * crosses midnight stays a single-day timed chip on its start day.
 */
export function isMultiDayEvent(e: CalendarEvent): boolean {
  if (e.endDate == null || e.date == null || e.endDate === e.date) return false;
  return e.time == null || e.durationMin >= 1440;
}

function coversDay(e: CalendarEvent, dayIso: string): boolean {
  if (e.date == null) return false;
  const end = e.endDate ?? e.date;
  return e.date <= dayIso && dayIso <= end;
}

/** Timed lived (Google) events for a given ISO day — placed on the timed grid. */
export function getTimedLivedForDay<T extends CalendarEvent>(events: T[], dayIso: string): T[] {
  return events.filter((e) => e.time != null && !isMultiDayEvent(e) && e.date === dayIso);
}

/** All-day + multi-day lived (Google) events covering a given ISO day — the all-day row. */
export function getAllDayLivedForDay<T extends CalendarEvent>(events: T[], dayIso: string): T[] {
  return events.filter((e) => (e.time == null || isMultiDayEvent(e)) && coversDay(e, dayIso));
}

/** Single-day all-day lived events for a day — the per-day cells (multi-day go in bars). */
export function getSingleDayAllDayLived<T extends CalendarEvent>(events: T[], dayIso: string): T[] {
  return events.filter((e) => e.time == null && !isMultiDayEvent(e) && e.date === dayIso);
}
