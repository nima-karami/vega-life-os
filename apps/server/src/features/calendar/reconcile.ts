import { randomUUID } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import { sweepTombstones } from "../../core/tombstone";
import {
  listChannelsForUid,
  listNearExpiryChannels,
  registerChannel,
  removeChannel,
} from "./channel-registry";
import type { GoogleCalendarClient } from "./google-client";
import { runLivedLane } from "./lived-engine";
import { runTaskLane, type SyncDeps, WriteCalendarMissingError } from "./sync-engine";
import { withSyncLock } from "./sync-lock";
import {
  type GcalAccount,
  isBenignSyncFault,
  listConnectedUids,
  readGcalAccount,
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
    const channelId = randomUUID();
    const channelToken = randomUUID();
    const { resourceId, expiration } = await client.watch(channel.calendarId, {
      channelId,
      channelToken,
      address: deps.webhookUrl,
    });
    await registerChannel(deps.firestore, {
      channelId,
      channelToken,
      resourceId,
      uid,
      calendarId: channel.calendarId,
      expiration,
    });
    await removeChannel(deps.firestore, channel.channelId);
    await client.stopChannel(channel.channelId, channel.resourceId).catch(() => undefined);
  }
  return near.length;
}

/** Drop registry rows for a deselected calendar's watch channels; Task 7 will also stop them at Google. */
async function retireVanishedChannels(
  firestore: Firestore,
  uid: string,
  vanishedCalendarIds: string[],
): Promise<void> {
  const gone = new Set(vanishedCalendarIds);
  const channels = (await listChannelsForUid(firestore, uid)).filter((channel) =>
    gone.has(channel.calendarId),
  );
  for (const channel of channels) await removeChannel(firestore, channel.channelId);
}

/** Both lanes plus token/channel bookkeeping — the happy path of one locked reconcile. */
async function reconcileLanes(
  deps: ReconcileDeps,
  uid: string,
  account: GcalAccount,
): Promise<SyncResult> {
  const writeCalendarId = account.writeCalendarId ?? "";
  const readCalendarIds = account.readCalendarIds ?? [];
  const lived = await runLivedLane(deps, uid, account);
  const task = await runTaskLane(deps, uid, account);
  const syncTokens = {
    ...(account.syncTokens ?? {}),
    ...lived.nextSyncTokens,
    ...(task.nextSyncToken ? { [writeCalendarId]: task.nextSyncToken } : {}),
  };
  for (const gone of lived.vanishedCalendarIds) delete syncTokens[gone];
  await writeGcalAccount(deps.firestore, uid, {
    syncTokens,
    ...(lived.vanishedCalendarIds.length
      ? { readCalendarIds: readCalendarIds.filter((id) => !lived.vanishedCalendarIds.includes(id)) }
      : {}),
  });
  if (lived.vanishedCalendarIds.length) {
    await removeSyncTokens(deps.firestore, uid, lived.vanishedCalendarIds);
    await retireVanishedChannels(deps.firestore, uid, lived.vanishedCalendarIds);
  }
  const tombstonesSwept = await sweepTombstones(deps.firestore, uid, Date.parse(deps.now()));
  const client = await deps.getClient(uid);
  const channelsRenewed = await renewChannels(deps, uid, client, deps.now());
  return {
    pulled: task.pulled,
    pushed: task.pushed,
    pushFailures: task.pushFailures,
    lived: lived.lived,
    tombstonesSwept,
    channelsRenewed,
  };
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
  const writeCalendarId = account.writeCalendarId;

  return withSyncLock(deps.firestore, uid, async () => {
    try {
      return await reconcileLanes(deps, uid, account);
    } catch (error) {
      if (error instanceof WriteCalendarMissingError)
        return pauseForMissingWriteCalendar(deps, uid, writeCalendarId);
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
      throw error;
    }
  }
  return { users: uids.length };
}
