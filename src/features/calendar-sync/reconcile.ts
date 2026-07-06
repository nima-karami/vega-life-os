import type { Task } from "@/features/tasks";
import type { BatchOp } from "./gcal";
import { fromGEvent, type GEvent, isSchedulable, stablePushKey, toGEvent } from "./map";

const keyOf = (e: GEvent) => e.extendedProperties?.private?.vegaKey;
const legacyIdOf = (e: GEvent) => e.extendedProperties?.private?.vegaTaskId;

/** An event VEGA owns (so it's safe to delete) — never touch foreign events on the calendar. */
const isVegaEvent = (e: GEvent) => Boolean(e.id?.startsWith("vega") || keyOf(e) || legacyIdOf(e));

/** Fields that, when changed, require a patch. */
const signature = (e: GEvent) => `${e.start?.dateTime ?? e.start?.date ?? ""}|${e.summary ?? ""}`;

export interface PullUpdate {
  taskId: string;
  date: string | null;
  time: string | null;
  /** the user deleted the event in Google → VEGA should unschedule (date=null). */
  unscheduled?: boolean;
}

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
 * Push: bring Google in line with VEGA as a stateless set-difference keyed on the deterministic
 * event id. `existing` is the FULL list of the VEGA calendar. Desired = one event per in-window
 * schedulable task. Insert the missing, patch the changed, delete our stale/duplicate events —
 * never foreign (unmarked) events. Since the id is a pure function of the stable key, multiple
 * stale events for one slot all fall in have−desired and collapse to the single canonical event.
 */
export function computeTaskBatch(tasks: Task[], existing: GEvent[]): BatchOp[] {
  const desired = new Map<string, GEvent>();
  for (const t of tasks.filter(isSchedulable)) {
    const body = toGEvent(t);
    if (body.id) desired.set(body.id, body);
  }
  const have = new Map<string, GEvent>();
  for (const e of existing) {
    if (e.id && e.status !== "cancelled" && isVegaEvent(e)) have.set(e.id, e);
  }

  const ops: BatchOp[] = [];
  for (const [id, body] of desired) {
    const cur = have.get(id);
    if (!cur) ops.push({ kind: "insert", id, body });
    else if (signature(cur) !== signature(body)) ops.push({ kind: "patch", id, body });
  }
  for (const id of have.keys()) {
    if (!desired.has(id)) ops.push({ kind: "delete", id });
  }
  return ops;
}
