import type { Task, Tombstone } from "@vega/shared";
import { addDays, format, parseISO, subDays } from "date-fns";
import type { Firestore } from "firebase-admin/firestore";
import { toWritable } from "../../core/repository";
import { RETENTION_DAYS } from "../../core/tombstone";
import { type CalendarListing, isRateLimit } from "./calendar-listing";
import {
  fromGEvent,
  type GEvent,
  getGoogleEventId,
  getStablePushKey,
  isSchedulable,
  toGEvent,
} from "./event-map";
import {
  applyMirrorListing,
  type MirrorRow,
  pruneCancelledRows,
  toMirrorGEvent,
  toMirrorRow,
  writeMirrorRows,
} from "./gcal-mirror";
import { type GoogleCalendarClient, GoogleHttpError } from "./google-client";
import type { ReconcileRun } from "./reconcile-run";
import type { RecordWriter } from "./record-writer";
import { formatInstantInZone } from "./time-zone";

export type SyncDeps = {
  firestore: Firestore;
  getClient: (uid: string) => Promise<GoogleCalendarClient>;
  now: () => string;
};

export type TaskLaneResult = {
  pushed: number;
  pulled: number;
  pushFailures: number;
  rateLimited: boolean;
};

export type PullUpdate = {
  taskId: string;
  date: string | null;
  time: string | null;
  unscheduled?: boolean;
};

export type BatchOp = { kind: "insert" | "patch" | "delete"; id: string; body?: GEvent };

// Back edge = tombstone retention: only inside it do we still know what the user deleted, so an
// older insert can't be told apart from resurrecting a deletion.
const PUSH_WINDOW = { backDays: RETENTION_DAYS, fwdDays: 90 };

export const getVegaKey = (event: GEvent) => event.extendedProperties?.private?.vegaKey;
const legacyIdOf = (event: GEvent) => event.extendedProperties?.private?.vegaTaskId;

/** VEGA-owned events are the only ones safe to delete — foreign calendar events are never touched. */
export const isVegaEvent = (event: GEvent) =>
  Boolean(event.id?.startsWith("vega") || getVegaKey(event) || legacyIdOf(event));

/**
 * Google echoes a pushed start either with a zone offset OR as a plain UTC instant (`…Z`), so the
 * raw text of two identical times differs. Project any zoned stamp back to its wall clock before
 * comparing — a bare 19-char slice reads `21:00:00Z` as the wall clock and re-patches forever, and
 * every patch re-notifies us, which is an endless (and metered) sync loop.
 */
const startSignature = (event: GEvent, accountZone: string): string => {
  const start = event.start;
  if (!start?.dateTime) return start?.date ?? "";
  if (start.dateTime.length <= 19) return start.dateTime;
  const instant = new Date(start.dateTime);
  // A stamp Google sends but we can't parse must not throw and strand the whole reconcile.
  if (Number.isNaN(instant.getTime())) return start.dateTime.slice(0, 19);
  const zoned = formatInstantInZone(instant, accountZone);
  return `${zoned.date}T${zoned.time}:00`;
};

// The zone stays in the signature so a browser timezone change still re-pushes the events instead
// of silently drifting (spec edge #24).
export const signatureOf = (event: GEvent, accountZone: string) =>
  `${startSignature(event, accountZone)}|${event.start?.timeZone ?? ""}|${event.summary ?? ""}`;

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
 * unschedules an unresolved task but NEVER a resolved (done/skip) one (commit 7af64aa), and never
 * when a newer VEGA reschedule outdates the deletion (a self-delete echo racing a re-schedule); a
 * moved event wins only under whole-event LWW.
 */
export function computePullUpdate(task: Task, event: GEvent, timeZone: string): PullUpdate | null {
  if (event.status === "cancelled") {
    if (task.status === "done" || task.status === "skip") return null;
    if (!googleWins(task, event)) return null;
    return { taskId: task.id, date: null, time: null, unscheduled: true };
  }
  const want = fromGEvent(event, timeZone);
  if (want.date === task.date && want.time === task.time) return null;
  if (!googleWins(task, event)) return null;
  return { taskId: task.id, date: want.date, time: want.time };
}

/**
 * A cancelled event may only unschedule the task it CURRENTLY represents — matched by its
 * self-describing id (no `extendedProperties` needed, which Google strips on cancellations), never
 * the legacy `vegaTaskId` fallback. So a re-keyed event's stale cancellation can never unschedule
 * the task that moved to a new id. The legacy fallback survives for non-cancelled move-adoption.
 */
function matchTaskForEvent(
  event: GEvent,
  byEventId: Map<string, Task>,
  byKey: Map<string, Task>,
  byLegacyId: Map<string, Task>,
): Task | undefined {
  if (event.status === "cancelled") return event.id ? byEventId.get(event.id) : undefined;
  const key = getVegaKey(event);
  const legacyId = legacyIdOf(event);
  return (key ? byKey.get(key) : undefined) ?? (legacyId ? byLegacyId.get(legacyId) : undefined);
}

export function computeTaskPull(tasks: Task[], events: GEvent[], timeZone: string): PullUpdate[] {
  const byEventId = new Map(tasks.map((task) => [getGoogleEventId(task), task]));
  const byKey = new Map(tasks.map((task) => [getStablePushKey(task), task]));
  const byLegacyId = new Map(tasks.map((task) => [task.id, task]));
  const updates: PullUpdate[] = [];
  for (const event of events) {
    const task = matchTaskForEvent(event, byEventId, byKey, byLegacyId);
    if (!task) continue;
    const update = computePullUpdate(task, event, timeZone);
    if (update) updates.push(update);
  }
  return updates;
}

/**
 * A resolved (done/skip) task stays scheduled so its completed day keeps counting, so a cancelled
 * event can't unschedule it — but the user DID delete that block in Google. Soft-delete it: tombstone
 * the event id so the push won't resurrect it, while the completion record is left untouched.
 */
function computeTaskTombstones(tasks: Task[], events: GEvent[], now: string): Tombstone[] {
  const byEventId = new Map(tasks.map((task) => [getGoogleEventId(task), task]));
  const out: Tombstone[] = [];
  for (const event of events) {
    if (event.status !== "cancelled" || !event.id) continue;
    const task = byEventId.get(event.id);
    if (task && (task.status === "done" || task.status === "skip")) {
      out.push({ collection: "tasks", id: event.id, deletedAt: event.updated || now });
    }
  }
  return out;
}

/** A tombstoned event resurrects only once VEGA's schedule edit outdates the deletion (LWW) — a
 * re-scheduled task re-creates its block; a stale tombstone is ignored and later swept. */
function isResurrectBlocked(task: Task, id: string, tombstonedAt: Map<string, string>): boolean {
  const deletedAt = tombstonedAt.get(id);
  if (!deletedAt) return false;
  const vega = newestVegaScheduleTime(task);
  return !vega || deletedAt > vega;
}

function indexTaskEventTombstones(tombstones: Tombstone[]): Map<string, string> {
  return new Map(
    tombstones
      .filter((tombstone) => tombstone.collection === "tasks")
      .map((tombstone) => [tombstone.id, tombstone.deletedAt]),
  );
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
  canInsert: (task: Task, id: string) => boolean,
  timeZone: string,
): BatchOp | null {
  const current = have.get(id);
  if (!current) return canInsert(task, id) ? { kind: "insert", id, body } : null;
  return signatureOf(current, timeZone) === signatureOf(body, timeZone)
    ? null
    : { kind: "patch", id, body };
}

export function computeTaskBatch(
  tasks: Task[],
  existing: GEvent[],
  canInsert: (task: Task, id: string) => boolean = () => true,
  timeZone = "UTC",
): BatchOp[] {
  const desired = buildDesiredEvents(tasks, timeZone);
  const have = buildExistingEvents(existing);

  const ops: BatchOp[] = [];
  for (const [id, entry] of desired) {
    const op = diffDesiredEvent(id, entry, have, canInsert, timeZone);
    if (op) ops.push(op);
  }
  for (const id of have.keys()) {
    if (!desired.has(id)) ops.push({ kind: "delete", id });
  }
  return ops;
}

export function makeWindowGuard(todayIso: string): (task: { date: string | null }) => boolean {
  const lo = format(addDays(parseISO(todayIso), -PUSH_WINDOW.backDays), "yyyy-MM-dd");
  const hi = format(addDays(parseISO(todayIso), PUSH_WINDOW.fwdDays), "yyyy-MM-dd");
  return (task) => task.date != null && task.date >= lo && task.date <= hi;
}

// A delete leaves a dated cancelled row so Google's echo of it is recognised as already known.
async function applyTaskOp(run: ReconcileRun, calendarId: string, op: BatchOp): Promise<void> {
  const { firestore, uid, client } = run;
  if (op.kind === "delete") {
    await client.deleteEvent(calendarId, op.id);
    const cancelled = toMirrorRow({ id: op.id, status: "cancelled", updated: run.now });
    await writeMirrorRows(firestore, uid, [cancelled]);
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

async function applyTaskBatch(
  run: ReconcileRun,
  calendarId: string,
  ops: BatchOp[],
): Promise<{ pushFailures: number; rateLimited: boolean }> {
  let pushFailures = 0;
  let rateLimited = false;
  for (const op of ops) {
    try {
      await applyTaskOp(run, calendarId, op);
    } catch (error) {
      if (!(error instanceof GoogleHttpError)) throw error;
      pushFailures += 1;
      if (isRateLimit(error.status)) rateLimited = true;
      else console.error(`gcal push failed: task ${op.kind} ${op.id} status ${error.status}`);
    }
  }
  return { pushFailures, rateLimited };
}

/** Write every pulled schedule change in one batch and return the task list as it now stands. */
async function applyTaskPull(
  writer: RecordWriter,
  tasks: Task[],
  pull: PullUpdate[],
): Promise<Task[]> {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const records = pull.flatMap((update) => {
    const task = byId.get(update.taskId);
    if (!task) return [];
    return [
      {
        ...toWritable<"tasks">(task),
        date: update.date,
        time: update.time,
        ...(update.unscheduled ? { status: "open" as const } : {}),
      },
    ];
  });
  for (const stored of await writer.upsertMany("tasks", records)) byId.set(stored.id, stored);
  return [...byId.values()];
}

function logTaskPush(uid: string, ops: BatchOp[]): void {
  // A settled sync writes nothing, and every write re-notifies us — so a non-empty batch on a
  // quiet calendar is the signature of a feedback loop. Name the ops so it can be diagnosed.
  if (ops.length === 0) return;
  console.log(
    JSON.stringify({
      event: "gcal-task-push",
      uid,
      total: ops.length,
      ops: ops.slice(0, 10).map((op) => `${op.kind}:${op.id}`),
    }),
  );
}

/**
 * Reconcile VEGA tasks ⇄ the dedicated write-calendar: pull moved/cancelled events, then push the
 * set-difference. `have` comes from the persisted mirror, not the live listing, so a task unscheduled
 * in VEGA (which never shows up in a Google delta) is still detected and its event evicted.
 */
export async function runTaskLane(
  run: ReconcileRun,
  listing: CalendarListing,
  tasks: Task[],
  mirror: Map<string, MirrorRow>,
): Promise<TaskLaneResult> {
  const { firestore, uid, account } = run;
  const writeCalendarId = account.writeCalendarId ?? "";
  const timeZone = account.timeZone ?? "UTC";
  const vegaDelta = listing.events.filter(isVegaEvent);

  const pull = computeTaskPull(tasks, vegaDelta, timeZone);
  const current = await applyTaskPull(run.writer, tasks, pull);
  const marks = computeTaskTombstones(tasks, vegaDelta, run.now);
  await run.writer.markTombstones(marks);
  run.tombstones.push(...marks);
  // Folded only after the pull lands, so a crash can't leave the mirror claiming an unpulled change.
  const listed = await applyMirrorListing(firestore, uid, mirror, vegaDelta, listing.mode);
  const retentionCutoff = subDays(parseISO(run.now), RETENTION_DAYS).toISOString();
  const nextMirror = await pruneCancelledRows(firestore, uid, listed, retentionCutoff);

  const tombstonedAt = indexTaskEventTombstones(run.tombstones);
  const inWindow = makeWindowGuard(run.now.slice(0, 10));
  const canInsert = (task: Task, id: string) =>
    inWindow(task) && !isResurrectBlocked(task, id, tombstonedAt);
  const haveEvents = [...nextMirror.values()].map(toMirrorGEvent);
  const ops = computeTaskBatch(current, haveEvents, canInsert, timeZone);
  logTaskPush(uid, ops);
  const { pushFailures, rateLimited } = await applyTaskBatch(run, writeCalendarId, ops);
  return { pushed: ops.length, pulled: pull.length, pushFailures, rateLimited };
}
