import { randomUUID } from "node:crypto";
import type { ChannelRegistration } from "@vega/shared";
import type { Firestore } from "firebase-admin/firestore";
import { listChannelsForUid, registerChannel, removeChannel } from "./channel-registry";
import type { GoogleCalendarClient } from "./google-client";
import type { ReconcileDeps } from "./reconcile";

const RENEW_THRESHOLD_MS = 2 * 864e5;

async function watchCalendar(
  deps: ReconcileDeps,
  uid: string,
  client: GoogleCalendarClient,
  calendarId: string,
): Promise<boolean> {
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
    return true;
  } catch {
    // watch quota/transient fault: sync degrades to the 5-min net; renewal retries later.
    return false;
  }
}

const coveredCalendars = (channels: ChannelRegistration[]) =>
  new Set(channels.map((channel) => channel.calendarId));

async function watchUncovered(
  deps: ReconcileDeps,
  uid: string,
  client: GoogleCalendarClient,
  calendarIds: string[],
  covered: Set<string>,
): Promise<number> {
  let registered = 0;
  for (const calendarId of calendarIds) {
    if (covered.has(calendarId)) continue;
    if (await watchCalendar(deps, uid, client, calendarId)) {
      covered.add(calendarId);
      registered += 1;
    }
  }
  return registered;
}

/** One watch channel per calendar; calendars that already have a live channel are skipped. */
export async function registerCalendarChannels(
  deps: ReconcileDeps,
  uid: string,
  client: GoogleCalendarClient,
  calendarIds: string[],
): Promise<number> {
  const existing = await listChannelsForUid(deps.firestore, uid);
  return watchUncovered(deps, uid, client, calendarIds, coveredCalendars(existing));
}

/**
 * Re-register channels within two days of expiry so Google never silently drops the subscription,
 * then watch any calendar still uncovered — all from one registry read. Returns how many were renewed.
 */
export async function maintainWatchChannels(
  deps: ReconcileDeps,
  uid: string,
  client: GoogleCalendarClient,
  calendarIds: string[],
  nowIso: string,
): Promise<number> {
  const soonIso = new Date(Date.parse(nowIso) + RENEW_THRESHOLD_MS).toISOString();
  const channels = await listChannelsForUid(deps.firestore, uid);
  const expiring = channels.filter((channel) => channel.expiration < soonIso);
  const covered = coveredCalendars(channels.filter((channel) => channel.expiration >= soonIso));
  for (const channel of expiring) {
    await removeChannel(deps.firestore, channel.channelId);
    await watchUncovered(deps, uid, client, [channel.calendarId], covered);
    await client.stopChannel(channel.channelId, channel.resourceId).catch(() => undefined);
  }
  await watchUncovered(deps, uid, client, calendarIds, covered);
  return expiring.length;
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
