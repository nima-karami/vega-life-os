import type { Task } from "@vega/shared";
import { addDays, format, parseISO } from "date-fns";
import type { Firestore } from "firebase-admin/firestore";
import { createRepository, toWritable } from "../../core/repository";
import { fromGEvent, type GEvent, getStablePushKey, isSchedulable, toGEvent } from "./event-map";
import {
  clearMirror,
  readMirror,
  removeMirrorRows,
  toMirrorGEvent,
  toMirrorRow,
  writeMirrorRows,
} from "./gcal-mirror";
import { type GoogleCalendarClient, GoogleHttpError, SyncTokenExpiredError } from "./google-client";
import type { GcalAccount } from "./token-store";

export type SyncDeps = {
  firestore: Firestore;
  getClient: (uid: string) => Promise<GoogleCalendarClient>;
  now: () => string;
};

/** The dedicated VEGA calendar is gone from Google — pause-and-ask, never auto-recreate (user decision, spec §0). */
export class WriteCalendarMissingError extends Error {
  constructor() {
    super("write calendar missing");
    this.name = "WriteCalendarMissingError";
  }
}

const isMissingCalendarFault = (error: unknown): boolean =>
  error instanceof GoogleHttpError && (error.status === 404 || error.status === 410);

export type TaskLaneResult = {
  pushed: number;
  pulled: number;
  pushFailures: number;
  rateLimited: boolean;
  nextSyncToken: string | null;
};

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

// Compare wall-clock only: our pushed body is naive, Google echoes an offset — slice past the
// seconds so the two representations of the same time don't re-patch every reconcile.
const signatureOf = (event: GEvent) =>
  `${(event.start?.dateTime ?? event.start?.date ?? "").slice(0, 19)}|${event.summary ?? ""}`;

function newestVegaScheduleTime(task: Task): string {
  const meta = task.fieldUpdatedAt ?? {};
  const scheduleStamps = [meta.date, meta.time].filter(Boolean) as string[];
  // Scope the LWW baseline to the schedule fields only. Folding in task.updatedAt
  // let an unrelated edit (title/note/order) veto a real Google reschedule; fall
  // back to it solely when a legacy task carries no per-field schedule stamps.
  if (scheduleStamps.length > 0) return scheduleStamps.sort().at(-1) ?? "";
  return task.updatedAt ?? "";
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
export function computePullUpdate(task: Task, event: GEvent, timeZone: string): PullUpdate | null {
  if (event.status === "cancelled") {
    if (task.status === "done" || task.status === "skip") return null;
    return { taskId: task.id, date: null, time: null, unscheduled: true };
  }
  const want = fromGEvent(event, timeZone);
  if (want.date === task.date && want.time === task.time) return null;
  if (!googleWins(task, event)) return null;
  return { taskId: task.id, date: want.date, time: want.time };
}

export function computeTaskPull(tasks: Task[], events: GEvent[], timeZone: string): PullUpdate[] {
  const byKey = new Map(tasks.map((task) => [getStablePushKey(task), task]));
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const updates: PullUpdate[] = [];
  for (const event of events) {
    const key = keyOf(event);
    const legacyId = legacyIdOf(event);
    const task = (key ? byKey.get(key) : undefined) ?? (legacyId ? byId.get(legacyId) : undefined);
    if (!task) continue;
    const update = computePullUpdate(task, event, timeZone);
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

function buildDesiredEvents(tasks: Task[], timeZone: string): Map<string, DesiredEvent> {
  const desired = new Map<string, DesiredEvent>();
  for (const task of tasks.filter(isSchedulable)) {
    const body = toGEvent(task, timeZone);
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
  timeZone = "UTC",
): BatchOp[] {
  const desired = buildDesiredEvents(tasks, timeZone);
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

/** Apply one op to Google and keep the mirror in step: a push writes the confirmed row, a delete removes it. */
async function applyTaskOp(
  firestore: Firestore,
  uid: string,
  client: GoogleCalendarClient,
  calendarId: string,
  op: BatchOp,
): Promise<void> {
  if (op.kind === "delete") {
    await client.deleteEvent(calendarId, op.id);
    await removeMirrorRows(firestore, uid, [op.id]);
    return;
  }
  if (!op.body) return;
  if (op.kind === "insert") await insertResurrecting(client, calendarId, op.body);
  else await client.patchEvent(calendarId, op.id, op.body);
  await writeMirrorRows(firestore, uid, [toMirrorRow({ ...op.body, status: "confirmed" })]);
}

/** Google retains a deleted event's id (status cancelled) and 409s the re-insert; patch it back to confirmed. */
async function insertResurrecting(
  client: GoogleCalendarClient,
  calendarId: string,
  body: GEvent,
): Promise<void> {
  try {
    await client.insertEvent(calendarId, body);
  } catch (error) {
    if (!(error instanceof GoogleHttpError) || error.status !== 409) throw error;
    await client.patchEvent(calendarId, body.id ?? "", { ...body, status: "confirmed" });
  }
}

const isRateLimit = (status: number) => status === 429 || status === 403 || status >= 500;

async function applyTaskBatch(
  firestore: Firestore,
  uid: string,
  client: GoogleCalendarClient,
  calendarId: string,
  ops: BatchOp[],
): Promise<{ pushFailures: number; rateLimited: boolean }> {
  let pushFailures = 0;
  let rateLimited = false;
  for (const op of ops) {
    try {
      await applyTaskOp(firestore, uid, client, calendarId, op);
    } catch (error) {
      if (!(error instanceof GoogleHttpError)) throw error;
      pushFailures += 1;
      if (isRateLimit(error.status)) rateLimited = true;
    }
  }
  return { pushFailures, rateLimited };
}

type WriteCalendarListing = {
  events: GEvent[];
  nextSyncToken: string | null;
  mode: "full" | "delta";
};

/** Prefer the stored delta token; a 410 (or first run) falls back to one full windowed list. */
async function listWriteCalendar(
  client: GoogleCalendarClient,
  calendarId: string,
  syncTokens: Record<string, string>,
): Promise<WriteCalendarListing> {
  const token = syncTokens[calendarId];
  if (token) {
    try {
      const delta = await client.listEvents(calendarId, { syncToken: token });
      return { ...delta, mode: "delta" };
    } catch (error) {
      if (isMissingCalendarFault(error)) throw new WriteCalendarMissingError();
      if (!(error instanceof SyncTokenExpiredError)) throw error;
    }
  }
  try {
    const full = await client.listEvents(calendarId, { window: TASK_WINDOW });
    return { ...full, mode: "full" };
  } catch (error) {
    if (isMissingCalendarFault(error)) throw new WriteCalendarMissingError();
    throw error;
  }
}

/**
 * Reconcile VEGA tasks ⇄ the dedicated write-calendar: pull moved/cancelled events, then push the
 * set-difference. `have` comes from a persisted mirror, not the live listing, so a task unscheduled
 * in VEGA (which never shows up in a Google delta) is still detected and its event evicted. A full
 * windowed list replaces the mirror wholesale, repairing any drift — the periodic verify pass.
 */
export async function runTaskLane(
  deps: SyncDeps,
  uid: string,
  account: GcalAccount,
): Promise<TaskLaneResult> {
  const writeCalendarId = account.writeCalendarId ?? "";
  const timeZone = account.timeZone ?? "UTC";
  const client = await deps.getClient(uid);
  const repo = createRepository(deps.firestore, uid, "tasks", deps.now);
  const tasks = await repo.list();

  const listed = await listWriteCalendar(client, writeCalendarId, account.syncTokens ?? {});
  const vegaDelta = listed.events.filter(isVegaEvent);
  if (listed.mode === "full") await clearMirror(deps.firestore, uid);
  await writeMirrorRows(deps.firestore, uid, vegaDelta.map(toMirrorRow));

  const pull = computeTaskPull(tasks, vegaDelta, timeZone);
  for (const update of pull) {
    const task = tasks.find((candidate) => candidate.id === update.taskId);
    if (!task) continue;
    await repo.upsert({
      ...toWritable<"tasks">(task),
      date: update.date,
      time: update.time,
      ...(update.unscheduled ? { status: "open" as const } : {}),
    });
  }

  const current = pull.length ? await repo.list() : tasks;
  const mirror = await readMirror(deps.firestore, uid);
  const haveEvents = [...mirror.values()].map(toMirrorGEvent);
  const inWindow = makeWindowGuard(deps.now().slice(0, 10));
  const ops = computeTaskBatch(current, haveEvents, inWindow, timeZone);
  const { pushFailures, rateLimited } = await applyTaskBatch(
    deps.firestore,
    uid,
    client,
    writeCalendarId,
    ops,
  );
  return {
    pushed: ops.length,
    pulled: pull.length,
    pushFailures,
    rateLimited,
    nextSyncToken: listed.nextSyncToken,
  };
}
