import type { Firestore } from "firebase-admin/firestore";
import type { GEvent, GEventTime } from "./event-map";

export type MirrorRow = {
  eventId: string;
  summary: string;
  start: GEventTime;
  status: string;
  updated: string | null;
  vegaKey: string | null;
};

const mirrorCollection = (firestore: Firestore, uid: string) =>
  firestore.collection(`users/${uid}/gcalMirror`);

export function toMirrorRow(event: GEvent): MirrorRow {
  return {
    eventId: event.id ?? "",
    summary: event.summary ?? "",
    start: event.start ?? {},
    status: event.status ?? "confirmed",
    updated: event.updated ?? null,
    vegaKey: event.extendedProperties?.private?.vegaKey ?? null,
  };
}

export function toMirrorGEvent(row: MirrorRow): GEvent {
  return {
    id: row.eventId,
    summary: row.summary,
    start: row.start,
    status: row.status,
    updated: row.updated ?? undefined,
    extendedProperties: row.vegaKey ? { private: { vegaKey: row.vegaKey } } : undefined,
  };
}

export async function readMirror(
  firestore: Firestore,
  uid: string,
): Promise<Map<string, MirrorRow>> {
  const snap = await mirrorCollection(firestore, uid).get();
  return new Map(snap.docs.map((doc) => [doc.id, doc.data() as MirrorRow]));
}

export async function writeMirrorRows(
  firestore: Firestore,
  uid: string,
  rows: MirrorRow[],
): Promise<void> {
  for (let i = 0; i < rows.length; i += 450) {
    const batch = firestore.batch();
    for (const row of rows.slice(i, i + 450)) {
      batch.set(mirrorCollection(firestore, uid).doc(row.eventId), row);
    }
    await batch.commit();
  }
}

async function removeMirrorRows(
  firestore: Firestore,
  uid: string,
  eventIds: string[],
): Promise<void> {
  for (let i = 0; i < eventIds.length; i += 450) {
    const batch = firestore.batch();
    for (const id of eventIds.slice(i, i + 450)) {
      batch.delete(mirrorCollection(firestore, uid).doc(id));
    }
    await batch.commit();
  }
}

/** Only the rows named, for the quiet gate — a whole-mirror read would cost one read per event. */
export async function readMirrorRows(
  firestore: Firestore,
  uid: string,
  eventIds: string[],
): Promise<Map<string, MirrorRow>> {
  if (eventIds.length === 0) return new Map();
  const collection = mirrorCollection(firestore, uid);
  const snaps = await firestore.getAll(...eventIds.map((id) => collection.doc(id)));
  return new Map(
    snaps.filter((snap) => snap.exists).map((snap) => [snap.id, snap.data() as MirrorRow]),
  );
}

const startKey = (start: GEventTime) =>
  `${start.date ?? ""}|${start.dateTime ?? ""}|${start.timeZone ?? ""}`;

function isSameMirrorRow(prior: MirrorRow | undefined, next: MirrorRow): boolean {
  return (
    prior !== undefined &&
    prior.summary === next.summary &&
    prior.status === next.status &&
    prior.updated === next.updated &&
    prior.vegaKey === next.vegaKey &&
    startKey(prior.start) === startKey(next.start)
  );
}

/**
 * Fold a listing into the mirror already in memory, writing only rows that moved. A full list
 * replaces the mirror wholesale (the periodic drift repair); a delta only overlays its events.
 */
export async function applyMirrorListing(
  firestore: Firestore,
  uid: string,
  mirror: Map<string, MirrorRow>,
  events: GEvent[],
  mode: "full" | "delta",
): Promise<Map<string, MirrorRow>> {
  const incoming = events.map(toMirrorRow);
  const next = mode === "full" ? new Map<string, MirrorRow>() : new Map(mirror);
  for (const row of incoming) next.set(row.eventId, row);
  const staleIds = mode === "full" ? [...mirror.keys()].filter((id) => !next.has(id)) : [];
  await removeMirrorRows(firestore, uid, staleIds);
  await writeMirrorRows(
    firestore,
    uid,
    incoming.filter((row) => !isSameMirrorRow(mirror.get(row.eventId), row)),
  );
  return next;
}

export async function clearMirror(firestore: Firestore, uid: string): Promise<void> {
  const snap = await mirrorCollection(firestore, uid).get();
  await removeMirrorRows(
    firestore,
    uid,
    snap.docs.map((doc) => doc.id),
  );
}
