import { sweepTombstones } from "../../core/tombstone";
import { clearSyncBackoff, isBackingOff, recordSyncFailure } from "./backoff";
import { listChannelsForUid, listNearExpiryChannels, removeChannel } from "./channel-registry";
import { registerCalendarChannels, stopCalendarChannels } from "./channel-setup";
import { type GoogleCalendarClient, GoogleHttpError } from "./google-client";
import { runLivedLane } from "./lived-engine";
import { migrateProfileCalendarConfig } from "./migrate-config";
import { runTaskLane, type SyncDeps, WriteCalendarMissingError } from "./sync-engine";
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

const RENEW_THRESHOLD_MS = 2 * 864e5;

export type ReconcileDeps = SyncDeps & { webhookUrl: string };

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

/** Re-register watch channels within two days of expiry so Google never silently drops the subscription. */
async function renewChannels(
  deps: ReconcileDeps,
  uid: string,
  client: GoogleCalendarClient,
  now: string,
): Promise<number> {
  const soonIso = new Date(Date.parse(now) + RENEW_THRESHOLD_MS).toISOString();
  const near = (await listNearExpiryChannels(deps.firestore, soonIso)).filter(
    (channel) => channel.uid === uid,
  );
  for (const channel of near) {
    await removeChannel(deps.firestore, channel.channelId);
    await registerCalendarChannels(deps, uid, client, [channel.calendarId]);
    await client.stopChannel(channel.channelId, channel.resourceId).catch(() => undefined);
  }
  return near.length;
}

type LaneOutcome = { result: SyncResult; listRateLimited: boolean };

/** Both lanes plus token/channel bookkeeping — the happy path of one locked reconcile. */
async function reconcileLanes(
  deps: ReconcileDeps,
  uid: string,
  account: GcalAccount,
): Promise<LaneOutcome> {
  const writeCalendarId = account.writeCalendarId ?? "";
  const readCalendarIds = account.readCalendarIds ?? [];
  const lived = await runLivedLane(deps, uid, account);
  const task = await runTaskLane(deps, uid, account);
  const activeReadCalendarIds = readCalendarIds.filter(
    (id) => !lived.vanishedCalendarIds.includes(id),
  );
  const syncTokens = {
    ...(account.syncTokens ?? {}),
    ...lived.nextSyncTokens,
    ...(task.nextSyncToken ? { [writeCalendarId]: task.nextSyncToken } : {}),
  };
  for (const gone of lived.vanishedCalendarIds) delete syncTokens[gone];
  await writeGcalAccount(deps.firestore, uid, {
    syncTokens,
    ...(lived.vanishedCalendarIds.length ? { readCalendarIds: activeReadCalendarIds } : {}),
  });
  const client = await deps.getClient(uid);
  if (lived.vanishedCalendarIds.length) {
    await removeSyncTokens(deps.firestore, uid, lived.vanishedCalendarIds);
    await removeCalendarPrefs(deps.firestore, uid, lived.vanishedCalendarIds);
    await stopCalendarChannels(deps.firestore, uid, client, lived.vanishedCalendarIds);
  }
  const tombstonesSwept = await sweepTombstones(deps.firestore, uid, Date.parse(deps.now()));
  const channelsRenewed = await renewChannels(deps, uid, client, deps.now());
  await registerCalendarChannels(deps, uid, client, [writeCalendarId, ...activeReadCalendarIds]);
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
  };
}

/** 403/429/5xx from Google — a quota or availability fault the caller retries under backoff. */
function isQuotaFault(error: unknown): error is GoogleHttpError {
  return (
    error instanceof GoogleHttpError &&
    (error.status === 429 || error.status === 403 || error.status >= 500)
  );
}

/** Extend the backoff window on a list-level rate-limit, clear it otherwise (also stamps lastSyncedAt). */
async function settleSyncBackoff(
  deps: ReconcileDeps,
  uid: string,
  account: GcalAccount,
  listRateLimited: boolean,
): Promise<void> {
  if (listRateLimited)
    await recordSyncFailure(deps.firestore, uid, account.backoff?.failures ?? 0, deps.now());
  else await clearSyncBackoff(deps.firestore, uid, deps.now());
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

/** Run both lanes for one uid under the per-uid lock, then sweep tombstones and renew near-expiry channels. */
export async function runReconcile(deps: ReconcileDeps, uid: string): Promise<SyncResult> {
  const account = await readGcalAccount(deps.firestore, uid);
  if (!account || account.needsReauth || !account.writeCalendarId || account.writeCalendarMissing)
    return emptyResult();
  if (isBackingOff(account.backoff, deps.now())) return emptyResult();
  const writeCalendarId = account.writeCalendarId;

  return withSyncLock(deps.firestore, uid, async () => {
    const migrated = await migrateProfileCalendarConfig(deps.firestore, uid, account);
    try {
      const { result, listRateLimited } = await reconcileLanes(deps, uid, migrated);
      await settleSyncBackoff(deps, uid, account, listRateLimited);
      return result;
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
