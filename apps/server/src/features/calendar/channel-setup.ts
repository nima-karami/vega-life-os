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
  let failures = 0;
  for (const calendarId of calendarIds) {
    if (covered.has(calendarId)) continue;
    if (await watchCalendar(deps, uid, client, calendarId)) covered.add(calendarId);
    else failures += 1;
  }
  return failures;
}

/** One watch channel per calendar; calendars that already have a live channel are skipped. */
export async function registerCalendarChannels(
  deps: ReconcileDeps,
  uid: string,
  client: GoogleCalendarClient,
  calendarIds: string[],
): Promise<void> {
  const existing = await listChannelsForUid(deps.firestore, uid);
  await watchUncovered(deps, uid, client, calendarIds, coveredCalendars(existing));
}

export type ChannelUpkeep = { renewed: number; failures: number };

/** Renew channels within two days of expiry and watch every uncovered calendar, from one registry read. */
export async function maintainWatchChannels(
  deps: ReconcileDeps,
  uid: string,
  client: GoogleCalendarClient,
  calendarIds: string[],
  nowIso: string,
): Promise<ChannelUpkeep> {
  const soonIso = new Date(Date.parse(nowIso) + RENEW_THRESHOLD_MS).toISOString();
  const channels = await listChannelsForUid(deps.firestore, uid);
  const expiring = channels.filter((channel) => channel.expiration < soonIso);
  const covered = coveredCalendars(channels.filter((channel) => channel.expiration >= soonIso));
  let failures = 0;
  for (const channel of expiring) {
    await removeChannel(deps.firestore, channel.channelId);
    failures += await watchUncovered(deps, uid, client, [channel.calendarId], covered);
    await client.stopChannel(channel.channelId, channel.resourceId).catch(() => undefined);
  }
  failures += await watchUncovered(deps, uid, client, calendarIds, covered);
  return { renewed: expiring.length, failures };
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
