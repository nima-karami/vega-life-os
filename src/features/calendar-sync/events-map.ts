import { addDays, addMinutes, differenceInMinutes, format, parseISO } from "date-fns";
import type { CalendarEvent } from "./events-model";
import { type GEvent, toLocalRFC3339 } from "./map";

const isoDay = (d: Date) => format(d, "yyyy-MM-dd");

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
  let endDate: string | null = null;
  let time: string | null = null;
  let durationMin = 0;
  if (ev.start?.dateTime) {
    const start = parseISO(ev.start.dateTime);
    date = isoDay(start);
    time = format(start, "HH:mm");
    const end = ev.end?.dateTime ? parseISO(ev.end.dateTime) : addMinutes(start, 30);
    durationMin = Math.max(0, differenceInMinutes(end, start));
    // last day the block actually touches (a block ending at midnight stays on its start day)
    endDate = isoDay(addMinutes(end, -1) < start ? start : addMinutes(end, -1));
  } else if (ev.start?.date) {
    date = ev.start.date;
    // Google all-day end.date is exclusive → the inclusive last day is one day back.
    endDate = ev.end?.date ? isoDay(addDays(parseISO(ev.end.date), -1)) : date;
    if (endDate < date) endDate = date;
  }
  return {
    googleId: ev.id ?? "",
    iCalUID: ev.iCalUID ?? ev.id ?? "",
    calendarId,
    title: ev.summary ?? "(no title)",
    date,
    endDate,
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
  e: Pick<CalendarEvent, "title" | "date" | "endDate" | "time" | "durationMin" | "allDay">,
): GEvent {
  const body: GEvent = { summary: e.title };
  if (!e.allDay && e.date && e.time) {
    const start = parseISO(`${e.date}T${e.time}:00`);
    body.start = { dateTime: toLocalRFC3339(start) };
    body.end = { dateTime: toLocalRFC3339(addMinutes(start, e.durationMin || 30)) };
  } else if (e.date) {
    // Preserve a multi-day span: Google all-day end.date is exclusive (last day + 1).
    body.start = { date: e.date };
    body.end = { date: isoDay(addDays(parseISO(e.endDate ?? e.date), 1)) };
  }
  return body;
}
