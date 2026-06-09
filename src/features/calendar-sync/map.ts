import { addMinutes, format, parseISO } from "date-fns";
import type { Task } from "@/features/tasks";

export interface GEvent {
  id?: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  extendedProperties?: { private?: { vegaTaskId?: string } };
  status?: string; // "cancelled" for deletions in incremental sync
}

/** A VEGA task is "schedulable" to the calendar when it has a date. */
export const isSchedulable = (t: Task): boolean =>
  t.date !== null && t.status !== "skip";

/** Build the Google event body for a VEGA task. Timed if it has a time, else all-day. */
export function toGEvent(t: Task): GEvent {
  const base: GEvent = {
    summary: t.title,
    extendedProperties: { private: { vegaTaskId: t.id } },
  };
  if (t.time) {
    const start = parseISO(`${t.date}T${t.time}:00`);
    const end = addMinutes(start, t.durationMin || 30);
    base.start = { dateTime: toLocalRFC3339(start) };
    base.end = { dateTime: toLocalRFC3339(end) };
  } else {
    base.start = { date: t.date! };
    base.end = { date: t.date! };
  }
  return base;
}

/** RFC3339 with local offset (date-fns format with xxx token). */
export function toLocalRFC3339(d: Date): string {
  return format(d, "yyyy-MM-dd'T'HH:mm:ssxxx");
}

/** Extract { date, time } a VEGA task should adopt from a (moved) Google event. */
export function fromGEvent(ev: GEvent): { date: string | null; time: string | null } {
  if (ev.start?.dateTime) {
    const d = parseISO(ev.start.dateTime);
    return { date: format(d, "yyyy-MM-dd"), time: format(d, "HH:mm") };
  }
  if (ev.start?.date) return { date: ev.start.date, time: null };
  return { date: null, time: null };
}
