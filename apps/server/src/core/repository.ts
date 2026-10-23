import type { CollectionName, Dataset } from "@vega/shared";
import type { Firestore } from "firebase-admin/firestore";
import { mergeWithFieldLww, type StoredRecord } from "./field-lww";
import { advanceSyncVersion, bumpSyncVersion } from "./sync-version";
import { writeTombstone } from "./tombstone";

export type StoredEntity<C extends CollectionName> = Dataset[C][number];
export type WritableEntity<C extends CollectionName> = Omit<
  StoredEntity<C>,
  "updatedAt" | "fieldUpdatedAt"
>;

/** Drop the server-owned meta so a stored record can be re-upserted through the field-LWW seam. */
export function toWritable<C extends CollectionName>(record: StoredEntity<C>): WritableEntity<C> {
  const { updatedAt: _updatedAt, fieldUpdatedAt: _fieldUpdatedAt, ...writable } = record;
  return writable as WritableEntity<C>;
}

/** A write made for a client, carrying the counter version it produced (null: it changed nothing). */
export type SyncedWrite<T> = { record: T; syncVersion: number | null };

export type Repository<C extends CollectionName> = {
  list(): Promise<StoredEntity<C>[]>;
  get(id: string): Promise<StoredEntity<C> | null>;
  upsert(record: WritableEntity<C>): Promise<StoredEntity<C>>;
  /** `upsert` for a client-facing mutation: one extra counter read buys the writer its version. */
  upsertSynced(record: WritableEntity<C>): Promise<SyncedWrite<StoredEntity<C>>>;
  remove(id: string): Promise<void>;
  removeSynced(id: string): Promise<number | null>;
};

export type Clock = () => string;

const systemClock: Clock = () => new Date().toISOString();

export function createRepository<C extends CollectionName>(
  firestore: Firestore,
  uid: string,
  collection: C,
  now: Clock = systemClock,
): Repository<C> {
  const col = firestore.collection(`users/${uid}/${collection}`);

  async function writeMerged(record: WritableEntity<C>) {
    const ref = col.doc((record as { id: string }).id);
    const priorSnap = await ref.get();
    const prior = priorSnap.exists ? (priorSnap.data() as StoredRecord) : null;
    const { merged, fieldUpdatedAt, changed } = mergeWithFieldLww(
      prior,
      record as Record<string, unknown>,
      now(),
    );
    const stamped = { ...merged, fieldUpdatedAt } as StoredEntity<C>;
    await ref.set(stamped);
    return { stamped, changed };
  }

  async function deleteWithTombstone(id: string) {
    await col.doc(id).delete();
    await writeTombstone(firestore, uid, collection, id, now());
  }

  return {
    async list() {
      const snap = await col.get();
      return snap.docs.map((doc) => doc.data() as StoredEntity<C>);
    },
    async get(id) {
      const snap = await col.doc(id).get();
      return snap.exists ? (snap.data() as StoredEntity<C>) : null;
    },
    async upsert(record) {
      const { stamped, changed } = await writeMerged(record);
      // A replayed identical write must not move the counter, or every client re-pulls the whole
      // account for nothing.
      if (changed) await bumpSyncVersion(firestore, uid);
      return stamped;
    },
    async upsertSynced(record) {
      const { stamped, changed } = await writeMerged(record);
      const syncVersion = changed ? await advanceSyncVersion(firestore, uid) : null;
      return { record: stamped, syncVersion };
    },
    async remove(id) {
      await deleteWithTombstone(id);
      await bumpSyncVersion(firestore, uid);
    },
    async removeSynced(id) {
      await deleteWithTombstone(id);
      return advanceSyncVersion(firestore, uid);
    },
  };
}
