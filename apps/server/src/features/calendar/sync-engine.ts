import type { Task } from "@vega/shared";
import { addDays, format, parseISO } from "date-fns";
import type { Firestore } from "firebase-admin/firestore";
import { createRepository } from "../../core/repository";
import { fromGEvent, type GEvent, getStablePushKey, isSchedulable, toGEvent } from "./event-map";
import { type GoogleCalendarClient, GoogleHttpError } from "./google-client";

export type SyncDeps = {
  firestore: Firestore;
  getClient: (uid: string) => Promise<GoogleCalendarClient>;
  now: () => string;
};

export type TaskLaneResult = { pushed: number; pulled: number; pushFailures: number };

export type PullUpdate = {
  taskId: string;
  date: string | null;
  time: string | null;
  unscheduled?: boolean;
};

export type BatchOp = { kind: "insert" | "patch" | "delete"; id: string; body?: GEvent };

const TASK_WINDOW = { backDays: 366, fwdDays: 732 };
const PUSH_WINDOW = { backDays: 7, fwdDays: 90 };

const keyOf = (event: GEvent) => event.extendedProperties?.private?.vegaKey;
const legacyIdOf = (event: GEvent) => event.extendedProperties?.private?.vegaTaskId;

/** VEGA-owned events are the only ones safe to delete — foreign calendar events are never touched. */
const isVegaEvent = (event: GEvent) =>
  Boolean(event.id?.startsWith("vega") || keyOf(event) || legacyIdOf(event));

const signatureOf = (event: GEvent) =>
  `${event.start?.dateTime ?? event.start?.date ?? ""}|${event.summary ?? ""}`;

function newestVegaScheduleTime(task: Task): string {
  const meta = task.fieldUpdatedAt ?? {};
  const times = [meta.date, meta.time, task.updatedAt].filter(Boolean) as string[];
  return times.sort().at(-1) ?? "";
}

/** Whole-event LWW: an inbound Google edit only wins when its `updated` is newer than VEGA's newest schedule-field time. */
function googleWins(task: Task, event: GEvent): boolean {
  if (!event.updated) return true;
  const vega = newestVegaScheduleTime(task);
  return !vega || event.updated > vega;
}

/**
 * The schedule change (if any) a task should adopt from its Google event. A cancelled event
 * unschedules an unresolved task but NEVER a resolved (done/skip) one (commit 7af64aa); a moved
 * event wins only under whole-event LWW.
 */
export function computePullUpdate(task: Task, event: GEvent): PullUpdate | null {
  if (event.status === "cancelled") {
    if (task.status === "done" || task.status === "skip") return null;
    return { taskId: task.id, date: null, time: null, unscheduled: true };
  }
  const want = fromGEvent(event);
  if (want.date === task.date && want.time === task.time) return null;
  if (!googleWins(task, event)) return null;
  return { taskId: task.id, date: want.date, time: want.time };
}

export function computeTaskPull(tasks: Task[], events: GEvent[]): PullUpdate[] {
  const byKey = new Map(tasks.map((task) => [getStablePushKey(task), task]));
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const updates: PullUpdate[] = [];
  for (const event of events) {
    const key = keyOf(event);
    const legacyId = legacyIdOf(event);
    const task = (key ? byKey.get(key) : undefined) ?? (legacyId ? byId.get(legacyId) : undefined);
    if (!task) continue;
    const update = computePullUpdate(task, event);
    if (update) updates.push(update);
  }
  return updates;
}

/**
 * Set-difference push. `desired` = ALL scheduled tasks (any date), so a still-scheduled task's
 * event is protected from deletion; `isInsertable` gates only *creation* to the push window. An
 * event aged past the window is kept, never evicted (commit f550ae2), so the pull can't misread a
 * self-inflicted deletion as the user unscheduling the task.
 */
type DesiredEvent = { body: GEvent; task: Task };

function buildDesiredEvents(tasks: Task[]): Map<string, DesiredEvent> {
  const desired = new Map<string, DesiredEvent>();
  for (const task of tasks.filter(isSchedulable)) {
    const body = toGEvent(task);
    if (body.id) desired.set(body.id, { body, task });
  }
  return desired;
}

function buildExistingEvents(existing: GEvent[]): Map<string, GEvent> {
  const have = new Map<string, GEvent>();
  for (const event of existing) {
    if (event.id && event.status !== "cancelled" && isVegaEvent(event)) have.set(event.id, event);
  }
  return have;
}

function diffDesiredEvent(
  id: string,
  { body, task }: DesiredEvent,
  have: Map<string, GEvent>,
  isInsertable: (task: Task) => boolean,
): BatchOp | null {
  const current = have.get(id);
  if (!current) return isInsertable(task) ? { kind: "insert", id, body } : null;
  return signatureOf(current) === signatureOf(body) ? null : { kind: "patch", id, body };
}

export function computeTaskBatch(
  tasks: Task[],
  existing: GEvent[],
  isInsertable: (task: Task) => boolean = () => true,
): BatchOp[] {
  const desired = buildDesiredEvents(tasks);
  const have = buildExistingEvents(existing);

  const ops: BatchOp[] = [];
  for (const [id, entry] of desired) {
    const op = diffDesiredEvent(id, entry, have, isInsertable);
    if (op) ops.push(op);
  }
  for (const id of have.keys()) {
    if (!desired.has(id)) ops.push({ kind: "delete", id });
  }
  return ops;
}

function makeWindowGuard(todayIso: string): (task: { date: string | null }) => boolean {
  const lo = format(addDays(parseISO(todayIso), -PUSH_WINDOW.backDays), "yyyy-MM-dd");
  const hi = format(addDays(parseISO(todayIso), PUSH_WINDOW.fwdDays), "yyyy-MM-dd");
  return (task) => task.date != null && task.date >= lo && task.date <= hi;
}

async function applyTaskBatch(
  client: GoogleCalendarClient,
  calendarId: string,
  ops: BatchOp[],
): Promise<number> {
  let pushFailures = 0;
  for (const op of ops) {
    try {
      if (op.kind === "insert" && op.body) await client.insertEvent(calendarId, op.body);
      else if (op.kind === "patch" && op.body) await client.patchEvent(calendarId, op.id, op.body);
      else if (op.kind === "delete") await client.deleteEvent(calendarId, op.id);
    } catch (error) {
      if (error instanceof GoogleHttpError) {
        pushFailures += 1;
        continue;
      }
      throw error;
    }
  }
  return pushFailures;
}

/** Reconcile VEGA tasks ⇄ the dedicated write-calendar: pull moved/cancelled events, then push the set-difference. */
export async function runTaskLane(
  deps: SyncDeps,
  uid: string,
  writeCalendarId: string,
): Promise<TaskLaneResult> {
  const client = await deps.getClient(uid);
  const repo = createRepository(deps.firestore, uid, "tasks", deps.now);
  const tasks = await repo.list();
  const { events } = await client.listEvents(writeCalendarId, {
    syncToken: null,
    filtered: true,
    window: TASK_WINDOW,
  });

  const pull = computeTaskPull(tasks, events);
  for (const update of pull) {
    const task = tasks.find((candidate) => candidate.id === update.taskId);
    if (!task) continue;
    const { updatedAt: _updatedAt, fieldUpdatedAt: _fieldUpdatedAt, ...writable } = task;
    await repo.upsert({
      ...writable,
      date: update.date,
      time: update.time,
      ...(update.unscheduled ? { status: "open" as const } : {}),
    });
  }

  const current = pull.length ? await repo.list() : tasks;
  const inWindow = makeWindowGuard(deps.now().slice(0, 10));
  const ops = computeTaskBatch(current, events, inWindow);
  const pushFailures = await applyTaskBatch(client, writeCalendarId, ops);
  return { pushed: ops.length, pulled: pull.length, pushFailures };
}
