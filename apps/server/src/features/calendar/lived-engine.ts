import { randomUUID } from "node:crypto";
import type { CalendarEvent } from "@vega/shared";
import { createRepository, toWritable, type WritableEntity } from "../../core/repository";
import { listTombstones, writeTombstone } from "../../core/tombstone";
import {
  calendarEventToGPatch,
  type GEvent,
  gEventToSyncedFields,
  type SyncedFields,
} from "./event-map";
import { type GoogleCalendarClient, GoogleHttpError } from "./google-client";
import type { SyncDeps } from "./sync-engine";

const LIVED_WINDOW = { backDays: 30, fwdDays: 120 };

type LivedRow = WritableEntity<"calendarEvents">;

const hasMeaning = (event: Pick<CalendarEvent, "valueId" | "goalId" | "note">) =>
  Boolean(event.valueId) || Boolean(event.goalId) || event.note.trim() !== "";

function insertRow(synced: SyncedFields): LivedRow {
  return {
    id: `ce_${randomUUID()}`,
    ...synced,
    valueId: null,
    goalId: null,
    note: "",
    vegaEditedAt: null,
    pendingDelete: false,
    removedAt: null,
  };
}

/** Merge a changed Google event onto its prior mirror; a pending local edit newer than Google's wins. */
function mergeRow(prior: CalendarEvent, synced: SyncedFields): LivedRow {
  const base = toWritable<"calendarEvents">(prior);
  const localWins =
    prior.vegaEditedAt != null &&
    (synced.googleUpdated == null || prior.vegaEditedAt > synced.googleUpdated);
  if (localWins) return { ...base, googleUpdated: synced.googleUpdated, removedAt: null };
  return {
    ...base,
    ...synced,
    valueId: prior.valueId,
    goalId: prior.goalId,
    note: prior.note,
    id: prior.id,
    vegaEditedAt: null,
    removedAt: null,
  };
}

export type LivedReconcile = { upserts: LivedRow[]; dropIds: string[] };

type LivedOutcome = { upsert?: LivedRow; dropId?: string };

function reconcileLivedEvent(
  synced: SyncedFields,
  prior: CalendarEvent | undefined,
  now: string,
  tombstonedGoogleIds: Set<string>,
): LivedOutcome {
  if (synced.status === "cancelled") {
    if (!prior) return {};
    return hasMeaning(prior)
      ? { upsert: { ...toWritable<"calendarEvents">(prior), removedAt: now } }
      : { dropId: prior.id };
  }
  if (!prior) {
    return tombstonedGoogleIds.has(synced.googleId) ? {} : { upsert: insertRow(synced) };
  }
  return { upsert: mergeRow(prior, synced) };
}

/** Merge one calendar's pulled events into the mirror; a tombstoned googleId is never resurrected. */
export function reconcileLived(
  existing: CalendarEvent[],
  incoming: GEvent[],
  calendarId: string,
  now: string,
  tombstonedGoogleIds: Set<string>,
  timeZone: string,
): LivedReconcile {
  const byGoogleId = new Map(existing.map((event) => [event.googleId, event]));
  const upserts: LivedRow[] = [];
  const dropIds: string[] = [];

  for (const event of incoming) {
    if (event.extendedProperties?.private?.vegaTaskId) continue;
    const synced = gEventToSyncedFields(event, calendarId, timeZone);
    const outcome = reconcileLivedEvent(
      synced,
      byGoogleId.get(synced.googleId),
      now,
      tombstonedGoogleIds,
    );
    if (outcome.upsert) upserts.push(outcome.upsert);
    if (outcome.dropId) dropIds.push(outcome.dropId);
  }
  return { upserts, dropIds };
}

async function pushLived(
  deps: SyncDeps,
  uid: string,
  client: GoogleCalendarClient,
  timeZone: string,
): Promise<void> {
  const repo = createRepository(deps.firestore, uid, "calendarEvents", deps.now);
  const rows = await repo.list();
  const now = deps.now();

  for (const row of rows.filter((event) => event.pendingDelete)) {
    try {
      await client.deleteEvent(row.calendarId, row.googleId);
      await repo.remove(row.id);
      await writeTombstone(deps.firestore, uid, "calendarEvents", row.googleId, now);
    } catch (error) {
      if (!(error instanceof GoogleHttpError)) throw error;
    }
  }
  for (const row of rows.filter((event) => event.vegaEditedAt)) {
    try {
      await client.patchEvent(row.calendarId, row.googleId, calendarEventToGPatch(row, timeZone));
      await repo.upsert({ ...toWritable<"calendarEvents">(row), vegaEditedAt: null });
    } catch (error) {
      if (!(error instanceof GoogleHttpError)) throw error;
    }
  }
}

/** Reconcile external calendars ⇄ the `calendarEvents` mirror: pull each read calendar, then push local edits/deletes. */
export async function runLivedLane(
  deps: SyncDeps,
  uid: string,
  writeCalendarId: string,
  readCalendarIds: string[],
  timeZone: string,
): Promise<{ lived: number }> {
  const client = await deps.getClient(uid);
  const repo = createRepository(deps.firestore, uid, "calendarEvents", deps.now);
  const now = deps.now();
  const tombstoned = new Set(
    (await listTombstones(deps.firestore, uid))
      .filter((tombstone) => tombstone.collection === "calendarEvents")
      .map((tombstone) => tombstone.id),
  );

  let lived = 0;
  for (const calendarId of readCalendarIds) {
    if (calendarId === writeCalendarId) continue;
    const { events } = await client.listEvents(calendarId, { window: LIVED_WINDOW });
    const existing = (await repo.list()).filter((event) => event.calendarId === calendarId);
    const { upserts, dropIds } = reconcileLived(
      existing,
      events,
      calendarId,
      now,
      tombstoned,
      timeZone,
    );
    for (const row of upserts) await repo.upsert(row);
    for (const id of dropIds) await repo.remove(id);
    lived += upserts.length + dropIds.length;
  }

  await pushLived(deps, uid, client, timeZone);
  return { lived };
}
