import { addMinutes, differenceInMinutes, format, parseISO } from "date-fns";
import type { CalendarEvent } from "./events-model";
import { type GEvent, toLocalRFC3339 } from "./map";

type SyncedFields = Omit<
  CalendarEvent,
  "id" | "valueId" | "goalId" | "note" | "vegaEditedAt" | "pendingDelete" | "removedAt"
>;

function selfResponse(ev: GEvent): CalendarEvent["responseStatus"] {
  const r = ev.attendees?.find((a) => a.self)?.responseStatus;
  return r === "accepted" || r === "declined" || r === "tentative" || r === "needsAction"
    ? r
    : null;
}

/** The Google-owned (synced) fields of a CalendarEvent — meaning/bookkeeping added by the store. */
export function gEventToCalendarEvent(ev: GEvent, calendarId: string): SyncedFields {
  const allDay = !ev.start?.dateTime;
  let date: string | null = null;
  let time: string | null = null;
  let durationMin = 0;
  if (ev.start?.dateTime) {
    const start = parseISO(ev.start.dateTime);
    date = format(start, "yyyy-MM-dd");
    time = format(start, "HH:mm");
    durationMin = ev.end?.dateTime
      ? Math.max(0, differenceInMinutes(parseISO(ev.end.dateTime), start))
      : 30;
  } else if (ev.start?.date) {
    date = ev.start.date;
  }
  return {
    googleId: ev.id ?? "",
    iCalUID: ev.iCalUID ?? ev.id ?? "",
    calendarId,
    title: ev.summary ?? "(no title)",
    date,
    time,
    durationMin,
    allDay,
    recurringEventId: ev.recurringEventId ?? null,
    googleUpdated: ev.updated ?? null,
    status: ev.status === "cancelled" ? "cancelled" : "confirmed",
    responseStatus: selfResponse(ev),
  };
}

/** Build the Google patch body (title + start/end) for a locally-edited event. */
export function calendarEventToGPatch(
  e: Pick<CalendarEvent, "title" | "date" | "time" | "durationMin" | "allDay">,
): GEvent {
  const body: GEvent = { summary: e.title };
  if (!e.allDay && e.date && e.time) {
    const start = parseISO(`${e.date}T${e.time}:00`);
    body.start = { dateTime: toLocalRFC3339(start) };
    body.end = { dateTime: toLocalRFC3339(addMinutes(start, e.durationMin || 30)) };
  } else if (e.date) {
    body.start = { date: e.date };
    body.end = { date: e.date };
  }
  return body;
}
