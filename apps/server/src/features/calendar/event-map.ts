import type { CalendarEvent, Task } from "@vega/shared";
import { addDays, addMinutes, differenceInMinutes, format, parseISO } from "date-fns";

export type GEventTime = { dateTime?: string; date?: string };

export type GEvent = {
  id?: string;
  iCalUID?: string;
  summary?: string;
  start?: GEventTime;
  end?: GEventTime;
  updated?: string;
  recurringEventId?: string;
  extendedProperties?: { private?: { vegaTaskId?: string; vegaKey?: string } };
  status?: string;
  attendees?: { self?: boolean; responseStatus?: string }[];
};

/**
 * A task reaches Google Calendar when it has a date and isn't skipped. Anytime-habit
 * instances (kind "habit", no time) are personal trackers, not calendar events.
 */
export function isSchedulable(task: Task): boolean {
  return task.date !== null && task.status !== "skip" && !(task.kind === "habit" && !task.time);
}

/** Immutable identity of a task's event: a habit slot keys on (habitId, slot); everything else on its id. */
export function getStablePushKey(task: Task): string {
  return task.kind === "habit" && task.habitId && !task.detached
    ? `habit:${task.habitId}:${task.slotDate ?? task.date}`
    : `task:${task.id}`;
}

/** Hex-encode behind a "vega" prefix → base32hex-safe, injective, within Google's id bounds. */
function encodeEventId(raw: string): string {
  let hex = "";
  for (const char of raw) hex += char.charCodeAt(0).toString(16).padStart(2, "0");
  return `vega${hex}`;
}

export function gEventId(task: Task): string {
  return encodeEventId(getStablePushKey(task));
}

export function toLocalRfc3339(date: Date): string {
  return format(date, "yyyy-MM-dd'T'HH:mm:ssxxx");
}

/** The Google event body VEGA writes for a task — timed if it has a time, else all-day. */
export function toGEvent(task: Task): GEvent {
  const body: GEvent = {
    id: gEventId(task),
    summary: task.title,
    extendedProperties: { private: { vegaTaskId: task.id, vegaKey: getStablePushKey(task) } },
  };
  if (task.time && task.date) {
    const start = parseISO(`${task.date}T${task.time}:00`);
    const end = addMinutes(start, task.durationMin || 30);
    body.start = { dateTime: toLocalRfc3339(start) };
    body.end = { dateTime: toLocalRfc3339(end) };
  } else {
    body.start = { date: task.date ?? undefined };
    body.end = { date: task.date ?? undefined };
  }
  return body;
}

/** The { date, time } a task should adopt from a (moved) Google event. */
export function fromGEvent(event: GEvent): { date: string | null; time: string | null } {
  if (event.start?.dateTime) {
    const start = parseISO(event.start.dateTime);
    return { date: format(start, "yyyy-MM-dd"), time: format(start, "HH:mm") };
  }
  if (event.start?.date) return { date: event.start.date, time: null };
  return { date: null, time: null };
}

const toIsoDay = (date: Date) => format(date, "yyyy-MM-dd");

export type SyncedFields = Omit<
  CalendarEvent,
  | "id"
  | "valueId"
  | "goalId"
  | "note"
  | "vegaEditedAt"
  | "pendingDelete"
  | "removedAt"
  | "updatedAt"
  | "fieldUpdatedAt"
>;

function readSelfResponse(event: GEvent): CalendarEvent["responseStatus"] {
  const response = event.attendees?.find((attendee) => attendee.self)?.responseStatus;
  return response === "accepted" ||
    response === "declined" ||
    response === "tentative" ||
    response === "needsAction"
    ? response
    : null;
}

/** The Google-owned fields of a mirrored lived event — meaning/bookkeeping fields are added by the store. */
export function gEventToSyncedFields(event: GEvent, calendarId: string): SyncedFields {
  const allDay = !event.start?.dateTime;
  const timing = allDay ? readAllDayTiming(event) : readTimedTiming(event);
  return {
    googleId: event.id ?? "",
    iCalUID: event.iCalUID ?? event.id ?? "",
    calendarId,
    title: event.summary ?? "(no title)",
    ...timing,
    allDay,
    recurringEventId: event.recurringEventId ?? null,
    googleUpdated: event.updated ?? null,
    status: event.status === "cancelled" ? "cancelled" : "confirmed",
    responseStatus: readSelfResponse(event),
  };
}

type EventTiming = Pick<CalendarEvent, "date" | "endDate" | "time" | "durationMin">;

function readTimedTiming(event: GEvent): EventTiming {
  const start = parseISO(event.start?.dateTime ?? "");
  const end = event.end?.dateTime ? parseISO(event.end.dateTime) : addMinutes(start, 30);
  const lastMoment = addMinutes(end, -1);
  return {
    date: toIsoDay(start),
    time: format(start, "HH:mm"),
    durationMin: Math.max(0, differenceInMinutes(end, start)),
    endDate: toIsoDay(lastMoment < start ? start : lastMoment),
  };
}

function readAllDayTiming(event: GEvent): EventTiming {
  if (!event.start?.date) return { date: null, endDate: null, time: null, durationMin: 0 };
  const date = event.start.date;
  let endDate = event.end?.date ? toIsoDay(addDays(parseISO(event.end.date), -1)) : date;
  if (endDate < date) endDate = date;
  return { date, endDate, time: null, durationMin: 0 };
}

/** The Google patch body (title + start/end) for a locally-edited lived event. */
export function calendarEventToGPatch(
  event: Pick<CalendarEvent, "title" | "date" | "endDate" | "time" | "durationMin" | "allDay">,
): GEvent {
  const body: GEvent = { summary: event.title };
  if (!event.allDay && event.date && event.time) {
    const start = parseISO(`${event.date}T${event.time}:00`);
    body.start = { dateTime: toLocalRfc3339(start) };
    body.end = { dateTime: toLocalRfc3339(addMinutes(start, event.durationMin || 30)) };
  } else if (event.date) {
    body.start = { date: event.date };
    body.end = { date: toIsoDay(addDays(parseISO(event.endDate ?? event.date), 1)) };
  }
  return body;
}
