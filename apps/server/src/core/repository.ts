import type { CollectionName, Dataset } from "@vega/shared";
import type { Firestore } from "firebase-admin/firestore";
import { mergeWithFieldLww, type StoredRecord } from "./field-lww";
import { writeTombstone } from "./tombstone";

export type StoredEntity<C extends CollectionName> = Dataset[C][number];
export type WritableEntity<C extends CollectionName> = Omit<
  StoredEntity<C>,
  "updatedAt" | "fieldUpdatedAt"
>;

export type Repository<C extends CollectionName> = {
  list(): Promise<StoredEntity<C>[]>;
  get(id: string): Promise<StoredEntity<C> | null>;
  upsert(record: WritableEntity<C>): Promise<StoredEntity<C>>;
  remove(id: string): Promise<void>;
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
      const id = (record as { id: string }).id;
      const ref = col.doc(id);
      const priorSnap = await ref.get();
      const prior = priorSnap.exists ? (priorSnap.data() as StoredRecord) : null;
      const { merged, fieldUpdatedAt } = mergeWithFieldLww(
        prior,
        record as Record<string, unknown>,
        now(),
      );
      const stamped = { ...merged, fieldUpdatedAt };
      await ref.set(stamped);
      return stamped as StoredEntity<C>;
    },
    async remove(id) {
      await col.doc(id).delete();
      await writeTombstone(firestore, uid, collection, id, now());
    },
  };
}
