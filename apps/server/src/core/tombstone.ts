import { type CollectionName, type Tombstone, tombstoneSchema } from "@vega/shared";
import type { Firestore } from "firebase-admin/firestore";

const RETENTION_DAYS = 30;

const tombstones = (firestore: Firestore, uid: string) =>
  firestore.collection(`users/${uid}/tombstones`);

const docId = (collectionName: CollectionName, id: string) =>
  `${collectionName}__${encodeURIComponent(id)}`;

/** Record a deletion so a stale mirror or a racing pull never re-creates the removed record. */
export async function writeTombstone(
  firestore: Firestore,
  uid: string,
  collectionName: CollectionName,
  id: string,
  deletedAt: string,
): Promise<void> {
  const tombstone = tombstoneSchema.parse({ id, collection: collectionName, deletedAt });
  await tombstones(firestore, uid).doc(docId(collectionName, id)).set(tombstone);
}

export async function hasTombstone(
  firestore: Firestore,
  uid: string,
  collectionName: CollectionName,
  id: string,
): Promise<boolean> {
  const snap = await tombstones(firestore, uid).doc(docId(collectionName, id)).get();
  return snap.exists;
}

export async function listTombstones(firestore: Firestore, uid: string): Promise<Tombstone[]> {
  const snap = await tombstones(firestore, uid).get();
  return snap.docs.map((doc) => doc.data() as Tombstone);
}

/** Drop tombstones past the 30-day retention window; returns how many were swept. */
export async function sweepTombstones(
  firestore: Firestore,
  uid: string,
  nowMs: number,
  retentionDays: number = RETENTION_DAYS,
): Promise<number> {
  const cutoff = nowMs - retentionDays * 864e5;
  const stale = (await listTombstones(firestore, uid)).filter(
    (tombstone) => Date.parse(tombstone.deletedAt) < cutoff,
  );
  await Promise.all(
    stale.map((tombstone) =>
      tombstones(firestore, uid).doc(docId(tombstone.collection, tombstone.id)).delete(),
    ),
  );
  return stale.length;
}
