import { randomUUID } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import { listChannelsForUid, registerChannel, removeChannel } from "./channel-registry";
import type { GoogleCalendarClient } from "./google-client";
import type { ReconcileDeps } from "./reconcile";

/** One watch channel per calendar; calendars that already have a live channel are skipped. */
export async function registerCalendarChannels(
  deps: ReconcileDeps,
  uid: string,
  client: GoogleCalendarClient,
  calendarIds: string[],
): Promise<number> {
  const existing = await listChannelsForUid(deps.firestore, uid);
  const covered = new Set(existing.map((channel) => channel.calendarId));
  let registered = 0;
  for (const calendarId of calendarIds) {
    if (covered.has(calendarId)) continue;
    const channelId = randomUUID();
    const channelToken = randomUUID();
    try {
      const { resourceId, expiration } = await client.watch(calendarId, {
        channelId,
        channelToken,
        address: deps.webhookUrl,
      });
      await registerChannel(deps.firestore, {
        channelId,
        channelToken,
        resourceId,
        uid,
        calendarId,
        expiration,
      });
      registered += 1;
    } catch {
      // watch quota/transient fault: sync degrades to the 5-min net; renewal retries later.
    }
  }
  return registered;
}

export async function stopCalendarChannels(
  firestore: Firestore,
  uid: string,
  client: GoogleCalendarClient | null,
  calendarIds: string[],
): Promise<void> {
  const channels = await listChannelsForUid(firestore, uid);
  for (const channel of channels.filter((c) => calendarIds.includes(c.calendarId))) {
    await client?.stopChannel(channel.channelId, channel.resourceId).catch(() => undefined);
    await removeChannel(firestore, channel.channelId);
  }
}
