import { randomUUID } from "node:crypto";
import type { CalendarEvent } from "@vega/shared";
import { addDays, format, parseISO } from "date-fns";
import { createRepository, toWritable } from "../../core/repository";
import {
  type CalendarListing,
  isRateLimit,
  LIVED_WINDOW,
  type ReadListing,
} from "./calendar-listing";
import {
  calendarEventToGPatch,
  type GEvent,
  gEventToSyncedFields,
  type SyncedFields,
} from "./event-map";
import { type GoogleCalendarClient, GoogleHttpError } from "./google-client";
import { createLivedRows, type LivedRow, type LivedRows } from "./lived-rows";
import type { ReconcileRun } from "./reconcile-run";
import { createRecordWriter } from "./record-writer";
import type { SyncDeps } from "./sync-engine";

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

type LivedReconcile = { upserts: LivedRow[]; dropIds: string[] };

type LivedOutcome = { upsert?: LivedRow; dropId?: string };

function inheritMeaning(row: LivedRow, meaning: MeaningFields): LivedOutcome {
  row.valueId = meaning.valueId;
  row.goalId = meaning.goalId;
  row.note = meaning.note;
  return { upsert: row, dropId: meaning.sourceRowId };
}

/** A retired mirror: a tagged row survives as a `removedAt` snapshot, a plain one is dropped. */
function retireOutcome(prior: CalendarEvent, now: string): LivedOutcome {
  if (prior.removedAt != null) return {};
  return hasMeaning(prior)
    ? { upsert: { ...toWritable<"calendarEvents">(prior), removedAt: now } }
    : { dropId: prior.id };
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
    return retireOutcome(prior, now);
  }
  if (!prior) {
    if (tombstonedGoogleIds.has(synced.googleId)) return {};
    if (!isInsertableDate(synced.date)) return {};
    const meaning = meaningByICalUID.get(synced.iCalUID);
    const row = insertRow(synced);
    // Inherit only on a true calendar-move (the source instance is gone); a fresh recurring-series
    // instance shares its iCalUID with tagged siblings but must stay untagged.
    return meaning?.sourceRemoved ? inheritMeaning(row, meaning) : { upsert: row };
  }
  return { upsert: mergeRow(prior, synced) };
}

/** Merge one calendar's pulled events into the mirror; a tombstoned googleId is never resurrected. */
function reconcileLived(
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
  const bySeriesId = groupInstancesBySeries(existing);
  const upserts: LivedRow[] = [];
  const dropIds: string[] = [];

  const collect = (outcome: LivedOutcome) => {
    if (outcome.upsert) upserts.push(outcome.upsert);
    if (outcome.dropId) dropIds.push(outcome.dropId);
  };

  for (const event of incoming) {
    if (event.extendedProperties?.private?.vegaTaskId) continue;
    const synced = gEventToSyncedFields(event, calendarId, timeZone);
    // Google reports a whole-series deletion as one cancelled item keyed by the series id, which
    // matches no expanded instance — without the fan-out every instance would outlive its series.
    if (synced.status === "cancelled" && !byGoogleId.has(synced.googleId)) {
      for (const instance of bySeriesId.get(synced.googleId) ?? [])
        collect(retireOutcome(instance, now));
      continue;
    }
    collect(
      reconcileLivedEvent(
        synced,
        byGoogleId.get(synced.googleId),
        now,
        tombstonedGoogleIds,
        meaningByICalUID,
        isInsertableDate,
      ),
    );
  }
  return { upserts, dropIds };
}

function groupInstancesBySeries(rows: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const bySeriesId = new Map<string, CalendarEvent[]>();
  for (const row of rows) {
    if (row.recurringEventId == null) continue;
    const instances = bySeriesId.get(row.recurringEventId) ?? [];
    instances.push(row);
    bySeriesId.set(row.recurringEventId, instances);
  }
  return bySeriesId;
}

function applyOutcome(rows: LivedRows, outcome: LivedOutcome): void {
  if (outcome.upsert) rows.put(outcome.upsert);
  if (outcome.dropId) rows.drop(outcome.dropId);
}

function retireMirrorRows(
  rows: LivedRows,
  now: string,
  shouldRetire: (row: CalendarEvent) => boolean,
): number {
  const retiring = rows.list().filter(shouldRetire);
  for (const row of retiring) applyOutcome(rows, retireOutcome(row, now));
  return retiring.length;
}

/** Outside a reconcile (a picker change, a disconnect): read the mirror, retire, and flush in one go. */
async function retireStoredMirrors(
  deps: SyncDeps,
  uid: string,
  nowIso: string,
  shouldRetire: (row: CalendarEvent) => boolean,
): Promise<number> {
  const stored = await createRepository(deps.firestore, uid, "calendarEvents").list();
  const rows = createLivedRows(stored, createRecordWriter(deps.firestore, uid, nowIso), nowIso);
  const retired = retireMirrorRows(rows, nowIso, shouldRetire);
  await rows.flush();
  return retired;
}

/** A tagged mirror survives its calendar vanishing (kept with `removedAt`); a plain one is dropped. */
export function retireCalendarMirrors(
  deps: SyncDeps,
  uid: string,
  calendarId: string,
  nowIso: string,
): Promise<number> {
  return retireStoredMirrors(deps, uid, nowIso, (row) => row.calendarId === calendarId);
}

/** Disconnecting leaves no engine to reconcile the mirror, so nothing may be left behind live. */
export function retireAllMirrors(deps: SyncDeps, uid: string, nowIso: string): Promise<number> {
  return retireStoredMirrors(deps, uid, nowIso, () => true);
}

/**
 * Order-independent cleanup for a Google-side move (or a shared-invite deletion): when a `removedAt`
 * mirror shares its iCalUID with a surviving confirmed twin, fold its meaning onto the twin and drop it.
 */
const instanceKey = (event: Pick<CalendarEvent, "iCalUID" | "date">) =>
  `${event.iCalUID}|${event.date ?? ""}`;

function dropSupersededRemovedRows(rows: LivedRows): void {
  const snapshot = rows.list();
  const survivorByInstance = new Map<string, CalendarEvent>();
  for (const row of snapshot) {
    if (row.removedAt == null && row.status === "confirmed")
      survivorByInstance.set(instanceKey(row), row);
  }
  for (const removed of snapshot) {
    if (removed.removedAt == null) continue;
    // Same iCalUID AND date = the one instance moved between calendars; a different-dated sibling
    // of a recurring series must not absorb this instance's meaning.
    const survivor = survivorByInstance.get(instanceKey(removed));
    if (!survivor) continue;
    if (hasMeaning(removed) && !hasMeaning(survivor)) {
      rows.put({
        ...toWritable<"calendarEvents">(survivor),
        valueId: removed.valueId,
        goalId: removed.goalId,
        note: removed.note,
      });
    }
    rows.drop(removed.id);
  }
}

type LivedDeleteOutcome = "deleted" | "already-gone" | "refused";

/**
 * A 404/410 means Google no longer has the event, so the user's delete is already satisfied —
 * aborting on it would strand the row as invisibly `pendingDelete` and re-attempt the call forever.
 */
async function deleteLivedEvent(
  client: GoogleCalendarClient,
  row: CalendarEvent,
): Promise<LivedDeleteOutcome> {
  try {
    await client.deleteEvent(row.calendarId, row.googleId);
    return "deleted";
  } catch (error) {
    if (!(error instanceof GoogleHttpError)) throw error;
    if (error.status === 404 || error.status === 410) return "already-gone";
    console.error(`gcal push failed: lived delete ${row.googleId} status ${error.status}`);
    return "refused";
  }
}

/** Push pending VEGA-side deletes and edits to Google; returns how many Google refused. */
async function pushLived(run: ReconcileRun, rows: LivedRows, timeZone: string): Promise<number> {
  const googleWrites: string[] = [];
  let pushFailures = 0;

  for (const row of rows.list().filter((event) => event.pendingDelete)) {
    const outcome = await deleteLivedEvent(run.client, row);
    if (outcome === "refused") {
      pushFailures += 1;
      continue;
    }
    if (outcome === "deleted") googleWrites.push(`delete:${row.googleId}`);
    rows.drop(row.id, row.googleId);
  }
  for (const row of rows.list().filter((event) => event.vegaEditedAt)) {
    try {
      await run.client.patchEvent(
        row.calendarId,
        row.googleId,
        calendarEventToGPatch(row, timeZone),
      );
      googleWrites.push(`patch:${row.googleId}`);
      rows.put({ ...toWritable<"calendarEvents">(row), vegaEditedAt: null });
    } catch (error) {
      if (!(error instanceof GoogleHttpError)) throw error;
      pushFailures += 1;
      if (!isRateLimit(error.status))
        console.error(`gcal push failed: lived patch ${row.googleId} status ${error.status}`);
    }
  }
  // A settled lived lane writes nothing; sustained writes mean a feedback loop.
  if (googleWrites.length > 0)
    console.log(
      JSON.stringify({
        event: "gcal-lived-push",
        uid: run.uid,
        total: googleWrites.length,
        ops: googleWrites.slice(0, 10),
      }),
    );
  return pushFailures;
}

type LivedWindow = {
  isInsertableDate: (date: string | null) => boolean;
  // Strictly inside the window (not merely overlapping the boundary) so a full-list absence is a real
  // deletion, never an event Google didn't list because it fell outside the requested range.
  isStrictlyInWindow: (event: CalendarEvent) => boolean;
};

function buildLivedWindow(nowIso: string): LivedWindow {
  const today = parseISO(nowIso.slice(0, 10));
  const lo = format(addDays(today, -LIVED_WINDOW.backDays), "yyyy-MM-dd");
  const hi = format(addDays(today, LIVED_WINDOW.fwdDays), "yyyy-MM-dd");
  return {
    isInsertableDate: (date) => date != null && date >= lo && date <= hi,
    isStrictlyInWindow: (event) =>
      event.date != null && event.date > lo && (event.endDate ?? event.date) < hi,
  };
}

function applyReadListing(
  rows: LivedRows,
  listing: CalendarListing,
  calendarId: string,
  now: string,
  tombstoned: Set<string>,
  window: LivedWindow,
  timeZone: string,
): number {
  const allRows = rows.list();
  const existing = allRows.filter((event) => event.calendarId === calendarId);
  const { upserts, dropIds } = reconcileLived(
    existing,
    listing.events,
    calendarId,
    now,
    tombstoned,
    buildMeaningIndex(allRows),
    window.isInsertableDate,
    timeZone,
  );
  for (const row of upserts) rows.put(row);
  for (const id of dropIds) rows.drop(id);
  const removedByAbsence =
    listing.mode === "full"
      ? retireAbsentRows(rows, existing, listing.events, now, window.isStrictlyInWindow)
      : 0;
  return upserts.length + dropIds.length + removedByAbsence;
}

/**
 * A full resync omits deletions (Google surfaces a cancellation only through a syncToken delta), so a
 * strictly-in-window mirror row absent from the listing was deleted on Google — retire it. Mirrors the
 * task lane's set-difference self-heal; scoped strictly in-window so an out-of-window event isn't false-dropped.
 */
function retireAbsentRows(
  rows: LivedRows,
  existing: CalendarEvent[],
  incoming: GEvent[],
  now: string,
  isInWindow: (event: CalendarEvent) => boolean,
): number {
  const listedIds = new Set(incoming.map((event) => event.id));
  const absent = existing.filter(
    (row) => row.removedAt == null && !listedIds.has(row.googleId) && isInWindow(row),
  );
  for (const row of absent) applyOutcome(rows, retireOutcome(row, now));
  return absent.length;
}

/**
 * No pull ever visits a row whose calendar left the selection, so one missed retire (a disconnect,
 * an interrupted `setReadCalendars`) would strand it on the calendar forever. An empty selection is
 * "not configured yet", never "sync nothing" — sweeping on it would wipe the whole mirror.
 */
function retireUnreachableRows(rows: LivedRows, readCalendarIds: string[], now: string): number {
  if (readCalendarIds.length === 0) return 0;
  const synced = new Set(readCalendarIds);
  return retireMirrorRows(rows, now, (row) => row.removedAt == null && !synced.has(row.calendarId));
}

export type LivedLaneResult = {
  lived: number;
  nextSyncTokens: Record<string, string>;
  vanishedCalendarIds: string[];
  rateLimited: boolean;
  faulted: number;
  pushFailures: number;
};

/** Reconcile external calendars ⇄ the `calendarEvents` mirror from the run's listings, then push local edits/deletes. */
export async function runLivedLane(
  run: ReconcileRun,
  reads: Map<string, ReadListing>,
  storedRows: CalendarEvent[],
): Promise<LivedLaneResult> {
  const timeZone = run.account.timeZone ?? "UTC";
  const rows = createLivedRows(storedRows, run.writer, run.now);
  const tombstoned = new Set(
    run.tombstones
      .filter((tombstone) => tombstone.collection === "calendarEvents")
      .map((tombstone) => tombstone.id),
  );
  const window = buildLivedWindow(run.now);

  const nextSyncTokens: Record<string, string> = {};
  const vanishedCalendarIds: string[] = [];
  let rateLimited = false;
  let faulted = 0;
  let lived = 0;
  for (const [calendarId, result] of reads) {
    if (result.kind === "vanished") {
      vanishedCalendarIds.push(calendarId);
      continue;
    }
    if (result.kind === "faulted") {
      faulted += 1;
      rateLimited = rateLimited || result.rateLimited;
      continue;
    }
    if (result.listing.nextSyncToken) nextSyncTokens[calendarId] = result.listing.nextSyncToken;
    lived += applyReadListing(
      rows,
      result.listing,
      calendarId,
      run.now,
      tombstoned,
      window,
      timeZone,
    );
  }

  for (const calendarId of vanishedCalendarIds) {
    retireMirrorRows(rows, run.now, (row) => row.calendarId === calendarId);
  }

  lived += retireUnreachableRows(rows, run.account.readCalendarIds ?? [], run.now);
  dropSupersededRemovedRows(rows);
  const pushFailures = await pushLived(run, rows, timeZone);
  await rows.flush();
  return { lived, nextSyncTokens, vanishedCalendarIds, rateLimited, faulted, pushFailures };
}
