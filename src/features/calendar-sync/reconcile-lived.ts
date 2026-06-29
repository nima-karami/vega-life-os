import { uid } from "@/core/lib/id";
import { gEventToCalendarEvent } from "./events-map";
import type { CalendarEvent } from "./events-model";
import type { GEvent } from "./map";

export const mkLocalId = () => uid("ce_");

const MEANING_KEYS = ["valueId", "goalId", "note"] as const;
const hasMeaning = (e: CalendarEvent) => !!e.valueId || !!e.goalId || e.note.trim() !== "";

type Synced = ReturnType<typeof gEventToCalendarEvent>;

const insert = (synced: Synced): CalendarEvent => ({
  id: mkLocalId(),
  ...synced,
  valueId: null,
  goalId: null,
  note: "",
  vegaEditedAt: null,
  pendingDelete: false,
  removedAt: null,
});

/** Merge a changed Google event onto its prior mirror, arbitrating local-vs-Google edits. */
function merge(prior: CalendarEvent, synced: Synced): CalendarEvent {
  // A pending local edit newer than Google's update wins; otherwise Google wins.
  const localWins =
    prior.vegaEditedAt != null &&
    (synced.googleUpdated == null || prior.vegaEditedAt > synced.googleUpdated);
  if (localWins) return { ...prior, googleUpdated: synced.googleUpdated, removedAt: null };
  return {
    ...prior,
    ...synced,
    ...Object.fromEntries(MEANING_KEYS.map((k) => [k, prior[k]])), // keep meaning
    id: prior.id,
    vegaEditedAt: null,
    removedAt: null,
  };
}

/** Merge one calendar's pulled events into the existing mirror set (pull side only). */
export function reconcileLived(
  existing: CalendarEvent[],
  incoming: GEvent[],
  calendarId: string,
  _todayIso: string,
): { upserts: CalendarEvent[]; dropIds: string[] } {
  const byGoogleId = new Map(existing.map((e) => [e.googleId, e]));
  const upserts: CalendarEvent[] = [];
  const dropIds: string[] = [];

  for (const ev of incoming) {
    if (ev.extendedProperties?.private?.vegaTaskId) continue; // task lane owns these
    const synced = gEventToCalendarEvent(ev, calendarId);
    const prior = byGoogleId.get(synced.googleId);

    if (synced.status === "cancelled") {
      if (!prior) continue;
      if (hasMeaning(prior)) upserts.push({ ...prior, removedAt: new Date().toISOString() });
      else dropIds.push(prior.id);
    } else if (!prior) {
      upserts.push(insert(synced));
    } else {
      upserts.push(merge(prior, synced));
    }
  }
  return { upserts, dropIds };
}

/** One visible row per iCalUID; hide declined-untagged and removed events. */
export function dedupeForDisplay(events: CalendarEvent[]): CalendarEvent[] {
  const seen = new Set<string>();
  const out: CalendarEvent[] = [];
  for (const e of events) {
    if (e.removedAt) continue;
    if (e.responseStatus === "declined" && !hasMeaning(e)) continue;
    if (seen.has(e.iCalUID)) continue;
    seen.add(e.iCalUID);
    out.push(e);
  }
  return out;
}
