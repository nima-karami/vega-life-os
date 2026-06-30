import { addMinutes, format, parseISO } from "date-fns";
import type { Task } from "@/features/tasks";

export interface GEvent {
  id?: string;
  iCalUID?: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  updated?: string;
  recurringEventId?: string;
  extendedProperties?: { private?: { vegaTaskId?: string; vegaKey?: string } };
  status?: string; // "cancelled" for deletions in incremental sync
  attendees?: { self?: boolean; responseStatus?: string }[];
}

/**
 * A VEGA task is "schedulable" to Google Calendar when it has a date and isn't
 * skipped. Anytime-habit instances (kind "habit", no time) are personal daily
 * trackers, not calendar events, so they are never pushed.
 */
export const isSchedulable = (t: Task): boolean =>
  t.date !== null && t.status !== "skip" && !(t.kind === "habit" && t.time === null);

/** Hex-encode an arbitrary key behind a "vega" prefix → valid base32hex (chars 0-9a-v),
 *  injective, within Google's 5–1024 id bound — so re-inserting under it is idempotent
 *  (a second insert collides on the id instead of creating a duplicate). */
function encodeId(raw: string): string {
  let hex = "";
  for (let i = 0; i < raw.length; i++) hex += raw.charCodeAt(i).toString(16).padStart(2, "0");
  return `vega${hex}`;
}

/** Deterministic Google event id for a task by its (stable) task id — the one-off path. */
export function gEventIdForTask(taskId: string): string {
  return encodeId(taskId);
}

/** Stable identity for matching a task to its pushed event. Habit instances had volatile
 *  task ids, so they key on the immutable (habitId, slot) — a regenerated or moved instance
 *  maps to the same event instead of churning. One-offs and detached instances key on their
 *  own stable id. Stored on the event as `vegaKey`; reconcile matches on it. */
export function stablePushKey(t: Task): string {
  return t.kind === "habit" && t.habitId && !t.detached
    ? `habit:${t.habitId}:${t.slotDate ?? t.date}`
    : `task:${t.id}`;
}

/** The Google event resource id. Habit instances derive it from the stable slot key so the
 *  id itself stops churning; one-offs keep their historical id (their task id is already
 *  stable) to avoid a needless one-time re-key of every existing event. */
export function gEventId(t: Task): string {
  return t.kind === "habit" && t.habitId && !t.detached
    ? encodeId(stablePushKey(t))
    : encodeId(t.id);
}

/** Build the Google event body for a VEGA task. Timed if it has a time, else all-day. */
export function toGEvent(t: Task): GEvent {
  const base: GEvent = {
    id: gEventId(t),
    summary: t.title,
    extendedProperties: { private: { vegaTaskId: t.id, vegaKey: stablePushKey(t) } },
  };
  if (t.time) {
    const start = parseISO(`${t.date}T${t.time}:00`);
    const end = addMinutes(start, t.durationMin || 30);
    base.start = { dateTime: toLocalRFC3339(start) };
    base.end = { dateTime: toLocalRFC3339(end) };
  } else {
    base.start = { date: t.date ?? undefined };
    base.end = { date: t.date ?? undefined };
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
