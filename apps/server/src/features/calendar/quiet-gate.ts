import type { CalendarListings } from "./calendar-listing";
import type { GEvent } from "./event-map";
import { type MirrorRow, toMirrorGEvent } from "./gcal-mirror";
import { getVegaKey, isVegaEvent, signatureOf } from "./sync-engine";
import type { GcalAccount } from "./token-store";

// While all three still hold, nothing on VEGA's side can need pushing.
export type ReconcileStamp = { syncVersion: number; day: string; configKey: string };

function buildConfigKey(account: GcalAccount): string {
  return JSON.stringify([
    account.writeCalendarId ?? "",
    [...(account.readCalendarIds ?? [])].sort(),
    account.timeZone ?? "UTC",
  ]);
}

export function buildReconcileStamp(
  account: GcalAccount,
  syncVersion: number,
  nowIso: string,
): ReconcileStamp {
  return { syncVersion, day: nowIso.slice(0, 10), configKey: buildConfigKey(account) };
}

/** A new UTC day always forces one full pass: the push windows move and housekeeping is due. */
export function isStampCurrent(
  stamp: ReconcileStamp | null | undefined,
  account: GcalAccount,
  syncVersion: number,
  nowIso: string,
): boolean {
  if (!stamp) return false;
  const current = buildReconcileStamp(account, syncVersion, nowIso);
  return (
    stamp.syncVersion === current.syncVersion &&
    stamp.day === current.day &&
    stamp.configKey === current.configKey
  );
}

/** The write-calendar events whose mirror rows decide whether the delta is only our own echo. */
export function listDeltaEventIds(listings: CalendarListings): string[] {
  return listings.write.events.filter(isVegaEvent).flatMap((event) => (event.id ? [event.id] : []));
}

/** The mirror already holds exactly what Google reports — the echo of our own push, or a replay. */
function isMirrored(event: GEvent, row: MirrorRow | undefined, timeZone: string): boolean {
  if (!row) return false;
  if (event.status === "cancelled") return row.status === "cancelled";
  return (
    row.status !== "cancelled" &&
    row.vegaKey === (getVegaKey(event) ?? null) &&
    signatureOf(toMirrorGEvent(row), timeZone) === signatureOf(event, timeZone)
  );
}

export function isQuietDelta(
  listings: CalendarListings,
  mirror: Map<string, MirrorRow>,
  timeZone: string,
): boolean {
  if (listings.write.mode !== "delta") return false;
  for (const read of listings.reads.values()) {
    if (read.kind !== "ok" || read.listing.mode !== "delta") return false;
    if (read.listing.events.some((event) => !event.extendedProperties?.private?.vegaTaskId))
      return false;
  }
  return listings.write.events
    .filter(isVegaEvent)
    .every((event) => isMirrored(event, mirror.get(event.id ?? ""), timeZone));
}
