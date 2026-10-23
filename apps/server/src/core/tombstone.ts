import { type CollectionName, type Tombstone, tombstoneSchema } from "@vega/shared";
import type { DocumentReference, Firestore, WriteBatch } from "firebase-admin/firestore";

export const RETENTION_DAYS = 30;

const tombstones = (firestore: Firestore, uid: string) =>
  firestore.collection(`users/${uid}/tombstones`);

const docId = (collectionName: CollectionName, id: string) =>
  `${collectionName}__${encodeURIComponent(id)}`;

function buildTombstoneWrite(
  firestore: Firestore,
  uid: string,
  collectionName: CollectionName,
  id: string,
  deletedAt: string,
): { ref: DocumentReference; tombstone: Tombstone } {
  return {
    ref: tombstones(firestore, uid).doc(docId(collectionName, id)),
    tombstone: tombstoneSchema.parse({ id, collection: collectionName, deletedAt }),
  };
}

/** Record a deletion so a stale mirror or a racing pull never re-creates the removed record. */
export async function writeTombstone(
  firestore: Firestore,
  uid: string,
  collectionName: CollectionName,
  id: string,
  deletedAt: string,
): Promise<void> {
  const { ref, tombstone } = buildTombstoneWrite(firestore, uid, collectionName, id, deletedAt);
  await ref.set(tombstone);
}

/** The batched form: a delete and its marker land in the same commit, so neither can survive alone. */
export function stageTombstone(
  batch: WriteBatch,
  firestore: Firestore,
  uid: string,
  collectionName: CollectionName,
  id: string,
  deletedAt: string,
): void {
  const { ref, tombstone } = buildTombstoneWrite(firestore, uid, collectionName, id, deletedAt);
  batch.set(ref, tombstone);
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

const SWEEP_BATCH_SIZE = 450;

/** Drop the already-listed tombstones that are past the retention window, in batched commits. */
export async function sweepListedTombstones(
  firestore: Firestore,
  uid: string,
  listed: Tombstone[],
  nowMs: number,
  retentionDays: number = RETENTION_DAYS,
): Promise<number> {
  const cutoff = nowMs - retentionDays * 864e5;
  const stale = listed.filter((tombstone) => Date.parse(tombstone.deletedAt) < cutoff);
  for (let start = 0; start < stale.length; start += SWEEP_BATCH_SIZE) {
    const batch = firestore.batch();
    for (const tombstone of stale.slice(start, start + SWEEP_BATCH_SIZE))
      batch.delete(tombstones(firestore, uid).doc(docId(tombstone.collection, tombstone.id)));
    await batch.commit();
  }
  return stale.length;
}
