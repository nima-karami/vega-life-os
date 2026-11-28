import type { CalendarEventCreate as CalendarEvent } from "../entities/calendar-event";

const hasMeaning = (event: CalendarEvent) =>
  !!event.valueId || !!event.goalId || event.note.trim() !== "";

/** Two synced calendars mirror one shared invite, but a recurring series' instances share an
 * iCalUID too — so the identity is iCalUID + date, or a whole series collapses to one chip. */
const instanceKey = (event: CalendarEvent) => `${event.iCalUID}|${event.date ?? ""}`;

/** One visible row per instance; hide declined-untagged and removed events. */
export function dedupeForDisplay<T extends CalendarEvent>(events: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const event of events) {
    if (event.removedAt || event.pendingDelete) continue;
    if (event.responseStatus === "declined" && !hasMeaning(event)) continue;
    if (seen.has(instanceKey(event))) continue;
    seen.add(instanceKey(event));
    out.push(event);
  }
  return out;
}

/** Display gate: dedupe (declined/removed already dropped there) then per-calendar visibility. */
export function filterVisibleEvents<T extends CalendarEvent>(
  events: T[],
  prefs: Record<string, { visible: boolean }>,
): T[] {
  return dedupeForDisplay(events).filter((event) => prefs[event.calendarId]?.visible ?? true);
}
