import { randomUUID } from "node:crypto";
import type { CalendarEvent } from "@vega/shared";
import { addDays, format, parseISO } from "date-fns";
import {
  createRepository,
  type Repository,
  toWritable,
  type WritableEntity,
} from "../../core/repository";
import { listTombstones, writeTombstone } from "../../core/tombstone";
import {
  calendarEventToGPatch,
  type GEvent,
  gEventToSyncedFields,
  type SyncedFields,
} from "./event-map";
import {
  type GoogleCalendarClient,
  GoogleHttpError,
  type ListEventsResult,
  SyncTokenExpiredError,
} from "./google-client";
import type { SyncDeps } from "./sync-engine";
import type { GcalAccount } from "./token-store";

const LIVED_WINDOW = { backDays: 30, fwdDays: 120 };

type LivedRow = WritableEntity<"calendarEvents">;

type MeaningFields = {
  valueId: string | null;
  goalId: string | null;
  note: string;
  sourceRowId: string;
  sourceRemoved: boolean;
};

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

/** Meaning (value/goal/note) keyed by iCalUID so a Google-side calendar move never strands tags. */
function buildMeaningIndex(rows: CalendarEvent[]): Map<string, MeaningFields> {
  const index = new Map<string, MeaningFields>();
  for (const row of rows) {
    if (!hasMeaning(row)) continue;
    index.set(row.iCalUID, {
      valueId: row.valueId,
      goalId: row.goalId,
      note: row.note,
      sourceRowId: row.id,
      sourceRemoved: row.removedAt != null,
    });
  }
  return index;
}

export type LivedReconcile = { upserts: LivedRow[]; dropIds: string[] };

type LivedOutcome = { upsert?: LivedRow; dropId?: string };

function inheritMeaning(row: LivedRow, meaning: MeaningFields): LivedOutcome {
  row.valueId = meaning.valueId;
  row.goalId = meaning.goalId;
  row.note = meaning.note;
  return meaning.sourceRemoved ? { upsert: row, dropId: meaning.sourceRowId } : { upsert: row };
}

function reconcileLivedEvent(
  synced: SyncedFields,
  prior: CalendarEvent | undefined,
  now: string,
  tombstonedGoogleIds: Set<string>,
  meaningByICalUID: Map<string, MeaningFields>,
  isInsertableDate: (date: string | null) => boolean,
): LivedOutcome {
  if (synced.status === "cancelled") {
    if (!prior) return {};
    return hasMeaning(prior)
      ? { upsert: { ...toWritable<"calendarEvents">(prior), removedAt: now } }
      : { dropId: prior.id };
  }
  if (!prior) {
    if (tombstonedGoogleIds.has(synced.googleId)) return {};
    if (!isInsertableDate(synced.date)) return {};
    const meaning = meaningByICalUID.get(synced.iCalUID);
    const row = insertRow(synced);
    return meaning ? inheritMeaning(row, meaning) : { upsert: row };
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
  meaningByICalUID: Map<string, MeaningFields>,
  isInsertableDate: (date: string | null) => boolean,
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
      meaningByICalUID,
      isInsertableDate,
    );
    if (outcome.upsert) upserts.push(outcome.upsert);
    if (outcome.dropId) dropIds.push(outcome.dropId);
  }
  return { upserts, dropIds };
}

/** A tagged mirror survives its calendar vanishing (kept with `removedAt`); a plain one is dropped. */
export async function retireCalendarMirrors(
  deps: SyncDeps,
  uid: string,
  calendarId: string,
  nowIso: string,
): Promise<void> {
  const repo = createRepository(deps.firestore, uid, "calendarEvents", deps.now);
  const rows = (await repo.list()).filter((event) => event.calendarId === calendarId);
  for (const row of rows) {
    if (hasMeaning(row)) {
      await repo.upsert({ ...toWritable<"calendarEvents">(row), removedAt: nowIso });
    } else {
      await repo.remove(row.id);
    }
  }
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

/** Prefer the stored delta token; a 410 (or first run) falls back to one full windowed list. */
async function listReadCalendar(
  client: GoogleCalendarClient,
  calendarId: string,
  syncTokens: Record<string, string>,
): Promise<ListEventsResult> {
  const token = syncTokens[calendarId];
  if (token) {
    try {
      return await client.listEvents(calendarId, { syncToken: token });
    } catch (error) {
      if (!(error instanceof SyncTokenExpiredError)) throw error;
    }
  }
  return client.listEvents(calendarId, { window: LIVED_WINDOW });
}

type ReadListing =
  | { kind: "ok"; listing: ListEventsResult }
  | { kind: "vanished" }
  | { kind: "faulted"; rateLimited: boolean };

/** List one read calendar, classifying a 404/410 as vanished and a 403/429/5xx as a retryable fault. */
async function classifyReadCalendar(
  client: GoogleCalendarClient,
  calendarId: string,
  syncTokens: Record<string, string>,
): Promise<ReadListing> {
  try {
    return { kind: "ok", listing: await listReadCalendar(client, calendarId, syncTokens) };
  } catch (error) {
    if (!(error instanceof GoogleHttpError)) throw error;
    if (error.status === 404 || error.status === 410) return { kind: "vanished" };
    return {
      kind: "faulted",
      rateLimited: error.status === 429 || error.status === 403 || error.status >= 500,
    };
  }
}

async function applyReadListing(
  repo: Repository<"calendarEvents">,
  listing: ListEventsResult,
  calendarId: string,
  now: string,
  tombstoned: Set<string>,
  isInsertableDate: (date: string | null) => boolean,
  timeZone: string,
): Promise<number> {
  const allRows = await repo.list();
  const existing = allRows.filter((event) => event.calendarId === calendarId);
  const meaningByICalUID = buildMeaningIndex(allRows);
  const { upserts, dropIds } = reconcileLived(
    existing,
    listing.events,
    calendarId,
    now,
    tombstoned,
    meaningByICalUID,
    isInsertableDate,
    timeZone,
  );
  for (const row of upserts) await repo.upsert(row);
  for (const id of dropIds) await repo.remove(id);
  return upserts.length + dropIds.length;
}

export type LivedLaneResult = {
  lived: number;
  nextSyncTokens: Record<string, string>;
  vanishedCalendarIds: string[];
  rateLimited: boolean;
};

/** Reconcile external calendars ⇄ the `calendarEvents` mirror: pull each read calendar via its delta token, then push local edits/deletes. */
export async function runLivedLane(
  deps: SyncDeps,
  uid: string,
  account: GcalAccount,
): Promise<LivedLaneResult> {
  const writeCalendarId = account.writeCalendarId ?? "";
  const readCalendarIds = account.readCalendarIds ?? [];
  const timeZone = account.timeZone ?? "UTC";
  const syncTokens = account.syncTokens ?? {};
  const client = await deps.getClient(uid);
  const repo = createRepository(deps.firestore, uid, "calendarEvents", deps.now);
  const now = deps.now();
  const tombstoned = new Set(
    (await listTombstones(deps.firestore, uid))
      .filter((tombstone) => tombstone.collection === "calendarEvents")
      .map((tombstone) => tombstone.id),
  );

  const nextSyncTokens: Record<string, string> = {};
  const vanishedCalendarIds: string[] = [];
  let rateLimited = false;
  const today = parseISO(now.slice(0, 10));
  const lo = format(addDays(today, -LIVED_WINDOW.backDays), "yyyy-MM-dd");
  const hi = format(addDays(today, LIVED_WINDOW.fwdDays), "yyyy-MM-dd");
  const isInsertableDate = (date: string | null) => date != null && date >= lo && date <= hi;

  let lived = 0;
  for (const calendarId of readCalendarIds) {
    if (calendarId === writeCalendarId) continue;
    const result = await classifyReadCalendar(client, calendarId, syncTokens);
    if (result.kind === "vanished") {
      vanishedCalendarIds.push(calendarId);
      continue;
    }
    if (result.kind === "faulted") {
      rateLimited = rateLimited || result.rateLimited;
      continue;
    }
    if (result.listing.nextSyncToken) nextSyncTokens[calendarId] = result.listing.nextSyncToken;
    lived += await applyReadListing(
      repo,
      result.listing,
      calendarId,
      now,
      tombstoned,
      isInsertableDate,
      timeZone,
    );
  }

  for (const calendarId of vanishedCalendarIds) {
    await retireCalendarMirrors(deps, uid, calendarId, now);
  }

  await pushLived(deps, uid, client, timeZone);
  return { lived, nextSyncTokens, vanishedCalendarIds, rateLimited };
}
