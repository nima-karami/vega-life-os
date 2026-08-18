import type { CalendarEvent } from "@vega/shared";

const hasMeaning = (event: CalendarEvent) =>
  !!event.valueId || !!event.goalId || event.note.trim() !== "";

/** Two synced calendars mirror one shared invite, but a recurring series' instances share an
 * iCalUID too — so the identity is iCalUID + date, or a whole series collapses to one chip. */
const instanceKey = (event: CalendarEvent) => `${event.iCalUID}|${event.date ?? ""}`;

/** One visible row per instance; hide declined-untagged and removed events. */
export function dedupeForDisplay(events: CalendarEvent[]): CalendarEvent[] {
  const seen = new Set<string>();
  const out: CalendarEvent[] = [];
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
export function filterVisibleEvents(
  events: CalendarEvent[],
  prefs: Record<string, { visible: boolean }>,
): CalendarEvent[] {
  return dedupeForDisplay(events).filter((event) => prefs[event.calendarId]?.visible ?? true);
}
