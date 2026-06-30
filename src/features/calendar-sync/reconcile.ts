import type { Task } from "@/features/tasks";
import { fromGEvent, type GEvent, isSchedulable, stablePushKey, toGEvent } from "./map";

const keyOf = (e: GEvent) => e.extendedProperties?.private?.vegaKey;
const legacyIdOf = (e: GEvent) => e.extendedProperties?.private?.vegaTaskId;

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
  // Match by stable key (the current occupant of a habit slot), falling back to the task id
  // for legacy events written before vegaKey existed.
  const byKey = new Map(tasks.map((t) => [stablePushKey(t), t]));
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const out: PullUpdate[] = [];
  for (const ev of events) {
    const key = keyOf(ev);
    const legacyId = legacyIdOf(ev);
    const t = (key ? byKey.get(key) : undefined) ?? (legacyId ? byId.get(legacyId) : undefined);
    if (!t) continue;
    if (ev.status === "cancelled") {
      out.push({ taskId: t.id, date: null, time: null, unscheduled: true });
      continue;
    }
    const want = fromGEvent(ev);
    if (want.date !== t.date || want.time !== t.time)
      out.push({ taskId: t.id, date: want.date, time: want.time });
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
  // Index live events by stable key; legacy events (no vegaKey) are matched by task id so
  // they re-key via patch rather than churn. A second event on the same key is a duplicate
  // from a prior insert-without-readback → delete the extra.
  const byKey = new Map<string, GEvent>();
  const byLegacyId = new Map<string, GEvent>();
  for (const e of live) {
    const key = keyOf(e);
    if (key) {
      if (byKey.has(key)) ops.push({ kind: "delete", taskId: legacyIdOf(e) ?? "", eventId: e.id });
      else byKey.set(key, e);
    } else {
      const id = legacyIdOf(e);
      if (id) byLegacyId.set(id, e);
    }
  }

  const claimedKeys = new Set<string>();
  const claimedLegacy = new Set<string>();
  for (const t of tasks.filter(isSchedulable)) {
    const key = stablePushKey(t);
    claimedKeys.add(key);
    const body = toGEvent(t);
    const ev = byKey.get(key) ?? byLegacyId.get(t.id);
    if (!ev) {
      ops.push({ kind: "insert", taskId: t.id, body });
      continue;
    }
    if (!keyOf(ev)) claimedLegacy.add(t.id);
    const moved = startKey(ev) !== startKey(body);
    const renamed = ev.summary !== body.summary;
    const needsKey = !keyOf(ev); // legacy event → patch to stamp vegaKey
    if (moved || renamed || needsKey)
      ops.push({ kind: "patch", taskId: t.id, eventId: ev.id, body });
  }
  // events whose owner is gone or no longer schedulable/in-window → delete
  for (const [key, ev] of byKey)
    if (!claimedKeys.has(key))
      ops.push({ kind: "delete", taskId: legacyIdOf(ev) ?? "", eventId: ev.id });
  for (const [id, ev] of byLegacyId)
    if (!claimedLegacy.has(id)) ops.push({ kind: "delete", taskId: id, eventId: ev.id });
  return ops;
}
