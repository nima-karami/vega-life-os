import { createRepository } from "../../core/repository";
import { readSyncVersion } from "../../core/sync-version";
import { listTombstones, sweepListedTombstones } from "../../core/tombstone";
import { buildBackoffPatch, isBackingOff, recordSyncFailure } from "./backoff";
import {
  type CalendarListings,
  listAccountCalendars,
  WriteCalendarMissingError,
} from "./calendar-listing";
import { listChannelsForUid, removeChannel } from "./channel-registry";
import { maintainWatchChannels, stopCalendarChannels } from "./channel-setup";
import { readMirror, readMirrorRows } from "./gcal-mirror";
import { GoogleHttpError } from "./google-client";
import { runLivedLane } from "./lived-engine";
import { migrateProfileCalendarConfig } from "./migrate-config";
import { buildReconcileStamp, isQuietDelta, isStampCurrent, listDeltaEventIds } from "./quiet-gate";
import type { ReconcileRun } from "./reconcile-run";
import { createRecordWriter } from "./record-writer";
import { runTaskLane, type SyncDeps } from "./sync-engine";
import { withSyncLock } from "./sync-lock";
import {
  type GcalAccount,
  isBenignSyncFault,
  listConnectedUids,
  readGcalAccount,
  removeCalendarPrefs,
  removeSyncTokens,
  writeGcalAccount,
} from "./token-store";

export type ReconcileDeps = SyncDeps & { webhookUrl: string };

/** `force` skips the quiet gate — for user actions, which must always re-verify both sides. */
export type ReconcileOptions = { force?: boolean };

export type SyncResult = {
  pulled: number;
  pushed: number;
  lived: number;
  pushFailures: number;
  channelsRenewed: number;
  tombstonesSwept: number;
};

const emptyResult = (): SyncResult => ({
  pulled: 0,
  pushed: 0,
  lived: 0,
  pushFailures: 0,
  channelsRenewed: 0,
  tombstonesSwept: 0,
});

function collectSyncTokens(account: GcalAccount, listings: CalendarListings) {
  const syncTokens = { ...(account.syncTokens ?? {}) };
  if (listings.write.nextSyncToken && account.writeCalendarId)
    syncTokens[account.writeCalendarId] = listings.write.nextSyncToken;
  for (const [calendarId, read] of listings.reads) {
    if (read.kind === "ok" && read.listing.nextSyncToken)
      syncTokens[calendarId] = read.listing.nextSyncToken;
  }
  return syncTokens;
}

/**
 * Nothing changed on VEGA's side since the last settled pass, and Google only echoed what we already
 * mirror: advance the delta tokens and stop, without reading a single task, event or tombstone.
 */
async function settleIfQuiet(
  run: ReconcileRun,
  listings: CalendarListings,
  syncVersion: number,
): Promise<boolean> {
  const { firestore, uid, account, now } = run;
  if (!isStampCurrent(account.lastReconcile, account, syncVersion, now)) return false;
  const mirrorRows = await readMirrorRows(firestore, uid, listDeltaEventIds(listings));
  if (!isQuietDelta(listings, mirrorRows, account.timeZone ?? "UTC")) return false;
  await writeGcalAccount(firestore, uid, {
    syncTokens: collectSyncTokens(account, listings),
    ...buildBackoffPatch(account, false, now),
  });
  return true;
}

type LaneOutcome = {
  result: SyncResult;
  listRateLimited: boolean;
  isSettled: boolean;
  vanishedCalendarIds: string[];
  activeReadCalendarIds: string[];
};

/** Both lanes from one read of each collection, then tombstone sweep and channel upkeep. */
async function reconcileLanes(
  deps: ReconcileDeps,
  run: ReconcileRun,
  listings: CalendarListings,
): Promise<LaneOutcome> {
  const { firestore, uid, account } = run;
  const [tasks, storedRows, mirror, tombstones] = await Promise.all([
    createRepository(firestore, uid, "tasks").list(),
    createRepository(firestore, uid, "calendarEvents").list(),
    readMirror(firestore, uid),
    listTombstones(firestore, uid),
  ]);
  run.tombstones.push(...tombstones);
  const lived = await runLivedLane(run, listings.reads, storedRows);
  const task = await runTaskLane(run, listings.write, tasks, mirror);

  if (lived.vanishedCalendarIds.length > 0)
    await stopCalendarChannels(firestore, uid, run.client, lived.vanishedCalendarIds);
  const activeReadCalendarIds = (account.readCalendarIds ?? []).filter(
    (id) => !lived.vanishedCalendarIds.includes(id),
  );
  const tombstonesSwept = await sweepListedTombstones(
    firestore,
    uid,
    tombstones,
    Date.parse(run.now),
  );
  const channelsRenewed = await maintainWatchChannels(
    deps,
    uid,
    run.client,
    [account.writeCalendarId ?? "", ...activeReadCalendarIds],
    run.now,
  );
  return {
    result: {
      pulled: task.pulled,
      pushed: task.pushed,
      pushFailures: task.pushFailures,
      lived: lived.lived,
      tombstonesSwept,
      channelsRenewed,
    },
    // Only a list-level rate-limit backs off; a partial push failure stays persisted and
    // self-heals on the next reconcile, so it must not gate the account out.
    listRateLimited: lived.rateLimited,
    // Anything left to retry must keep the next run on the full path, so it carries no stamp.
    isSettled:
      task.pushFailures === 0 &&
      lived.pushFailures === 0 &&
      lived.faulted === 0 &&
      lived.vanishedCalendarIds.length === 0,
    vanishedCalendarIds: lived.vanishedCalendarIds,
    activeReadCalendarIds,
  };
}

/** One account write closes the run: delta tokens, backoff, and the stamp the next quiet gate trusts. */
async function finishFullRun(
  run: ReconcileRun,
  listings: CalendarListings,
  outcome: LaneOutcome,
  startVersion: number,
): Promise<void> {
  const { firestore, uid, account, now } = run;
  const endVersion = await readSyncVersion(firestore, uid);
  // Only our own bumps since the start means VEGA's state is exactly what this run left behind.
  const settledVersion =
    endVersion === startVersion + run.writer.countBumps() ? endVersion : startVersion;
  const vanished = outcome.vanishedCalendarIds;
  await writeGcalAccount(firestore, uid, {
    syncTokens: collectSyncTokens(account, listings),
    ...(vanished.length > 0 ? { readCalendarIds: outcome.activeReadCalendarIds } : {}),
    lastReconcile: outcome.isSettled ? buildReconcileStamp(account, settledVersion, now) : null,
    ...buildBackoffPatch(account, outcome.listRateLimited, now),
  });
  // A merge write can't drop a map key, so a vanished calendar's token and prefs go after it.
  if (vanished.length > 0) {
    await removeSyncTokens(firestore, uid, vanished);
    await removeCalendarPrefs(firestore, uid, vanished);
  }
}

/** 403/429/5xx from Google — a quota or availability fault the caller retries under backoff. */
function isQuotaFault(error: unknown): error is GoogleHttpError {
  return (
    error instanceof GoogleHttpError &&
    (error.status === 429 || error.status === 403 || error.status >= 500)
  );
}

/** Flag the account and drop the dead write-calendar's watch channels so sync stays paused until the user acts. */
async function pauseForMissingWriteCalendar(
  deps: ReconcileDeps,
  uid: string,
  writeCalendarId: string,
): Promise<SyncResult> {
  await writeGcalAccount(deps.firestore, uid, { writeCalendarMissing: true });
  const channels = await listChannelsForUid(deps.firestore, uid);
  for (const channel of channels.filter((channel) => channel.calendarId === writeCalendarId)) {
    await removeChannel(deps.firestore, channel.channelId);
  }
  return emptyResult();
}

async function runLockedReconcile(
  deps: ReconcileDeps,
  uid: string,
  account: GcalAccount,
  options: ReconcileOptions,
): Promise<SyncResult> {
  const migrated = await migrateProfileCalendarConfig(deps.firestore, uid, account);
  const startVersion = await readSyncVersion(deps.firestore, uid);
  const now = deps.now();
  const run: ReconcileRun = {
    firestore: deps.firestore,
    uid,
    client: await deps.getClient(uid),
    account: migrated,
    now,
    writer: createRecordWriter(deps.firestore, uid, now),
    tombstones: [],
  };
  const listings = await listAccountCalendars(run.client, migrated);
  if (!options.force && (await settleIfQuiet(run, listings, startVersion))) return emptyResult();
  const outcome = await reconcileLanes(deps, run, listings);
  await finishFullRun(run, listings, outcome, startVersion);
  return outcome.result;
}

/** Run both lanes for one uid under the per-uid lock — or, when nothing changed, just advance the tokens. */
export async function runReconcile(
  deps: ReconcileDeps,
  uid: string,
  options: ReconcileOptions = {},
): Promise<SyncResult> {
  const account = await readGcalAccount(deps.firestore, uid);
  if (!account || account.needsReauth || !account.writeCalendarId || account.writeCalendarMissing)
    return emptyResult();
  if (isBackingOff(account.backoff, deps.now())) return emptyResult();
  const writeCalendarId = account.writeCalendarId;

  return withSyncLock(deps.firestore, uid, async () => {
    try {
      return await runLockedReconcile(deps, uid, account, options);
    } catch (error) {
      if (error instanceof WriteCalendarMissingError)
        return pauseForMissingWriteCalendar(deps, uid, writeCalendarId);
      if (isQuotaFault(error)) {
        await recordSyncFailure(deps.firestore, uid, account.backoff?.failures ?? 0, deps.now());
        return emptyResult();
      }
      throw error;
    }
  });
}

/** Reconcile every connected user — the Cloud Scheduler entry point; per-uid faults don't abort the batch. */
export async function runReconcileAll(deps: ReconcileDeps): Promise<{ users: number }> {
  const uids = await listConnectedUids(deps.firestore);
  for (const uid of uids) {
    try {
      await runReconcile(deps, uid);
    } catch (error) {
      if (isBenignSyncFault(error)) continue;
      // A non-benign fault for one uid must never starve the rest of the scheduled batch.
      console.error(`reconcile failed for uid ${uid}`, error);
    }
  }
  return { users: uids.length };
}
