import type { Task } from "@/features/tasks";
import { fromGEvent, type GEvent, isSchedulable, toGEvent } from "./map";

export interface PushOp {
  kind: "insert" | "patch" | "delete";
  taskId: string;
  eventId?: string; // for patch/delete
  body?: GEvent; // for insert/patch
}

export interface PullUpdate {
  taskId: string;
  date: string | null;
  time: string | null;
  /** the user deleted the event in Google → VEGA should unschedule (date=null). */
  unscheduled?: boolean;
}

const startKey = (ev: GEvent) => ev.start?.dateTime ?? ev.start?.date ?? "";

/**
 * Pull: changes the user made to VEGA-originated events in Google Calendar,
 * to apply back to VEGA tasks. Compares each tagged event's start against the
 * task's current scheduled start; cancelled events → unschedule.
 */
export function computePull(tasks: Task[], events: GEvent[]): PullUpdate[] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const out: PullUpdate[] = [];
  for (const ev of events) {
    const taskId = ev.extendedProperties?.private?.vegaTaskId;
    if (!taskId) continue;
    const t = byId.get(taskId);
    if (!t) continue;
    if (ev.status === "cancelled") {
      out.push({ taskId, date: null, time: null, unscheduled: true });
      continue;
    }
    const want = fromGEvent(ev);
    if (want.date !== t.date || want.time !== t.time)
      out.push({ taskId, date: want.date, time: want.time });
  }
  return out;
}

/**
 * Push: bring Google in line with VEGA. Insert events for newly-scheduled tasks,
 * patch events whose task moved/renamed, delete events whose task is gone or
 * unscheduled. `events` is the set of live (non-cancelled) VEGA-tagged events.
 */
export function computePush(tasks: Task[], events: GEvent[]): PushOp[] {
  const live = events.filter((e) => e.status !== "cancelled");
  const ops: PushOp[] = [];
  // One event per task wins; any further events sharing the tag are duplicates from a
  // prior insert-without-readback — delete the extras so each task maps to one event.
  const eventByTask = new Map<string, GEvent>();
  for (const e of live) {
    const id = e.extendedProperties?.private?.vegaTaskId;
    if (!id) continue;
    if (eventByTask.has(id)) ops.push({ kind: "delete", taskId: id, eventId: e.id });
    else eventByTask.set(id, e);
  }
  const scheduled = tasks.filter(isSchedulable);
  const scheduledIds = new Set(scheduled.map((t) => t.id));

  for (const t of scheduled) {
    const ev = eventByTask.get(t.id);
    const body = toGEvent(t);
    if (!ev) {
      ops.push({ kind: "insert", taskId: t.id, body });
      continue;
    }
    const moved = startKey(ev) !== startKey({ ...body });
    const renamed = ev.summary !== body.summary;
    if (moved || renamed) ops.push({ kind: "patch", taskId: t.id, eventId: ev.id, body });
  }
  // the kept event for a task that's no longer schedulable → delete
  for (const [id, ev] of eventByTask) {
    if (!scheduledIds.has(id)) ops.push({ kind: "delete", taskId: id, eventId: ev.id });
  }
  return ops;
}
