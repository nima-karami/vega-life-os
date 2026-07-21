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

export async function removeMirrorRows(
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

export async function clearMirror(firestore: Firestore, uid: string): Promise<void> {
  const snap = await mirrorCollection(firestore, uid).get();
  await removeMirrorRows(
    firestore,
    uid,
    snap.docs.map((doc) => doc.id),
  );
}
