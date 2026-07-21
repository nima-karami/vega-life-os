import { randomUUID } from "node:crypto";
import { sweepTombstones } from "../../core/tombstone";
import { listNearExpiryChannels, registerChannel, removeChannel } from "./channel-registry";
import type { GoogleCalendarClient } from "./google-client";
import { runLivedLane } from "./lived-engine";
import { runTaskLane, type SyncDeps } from "./sync-engine";
import { withSyncLock } from "./sync-lock";
import { isBenignSyncFault, listConnectedUids, readGcalAccount } from "./token-store";

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

/** Run both lanes for one uid under the per-uid lock, then sweep tombstones and renew near-expiry channels. */
export async function runReconcile(deps: ReconcileDeps, uid: string): Promise<SyncResult> {
  const account = await readGcalAccount(deps.firestore, uid);
  if (!account || account.needsReauth || !account.writeCalendarId) return emptyResult();
  const writeCalendarId = account.writeCalendarId;
  const readCalendarIds = account.readCalendarIds ?? [];
  const timeZone = account.timeZone ?? "UTC";

  return withSyncLock(deps.firestore, uid, async () => {
    const lived = await runLivedLane(deps, uid, writeCalendarId, readCalendarIds, timeZone);
    const task = await runTaskLane(deps, uid, writeCalendarId, timeZone);
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
