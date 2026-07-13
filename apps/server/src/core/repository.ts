import type { CollectionName, Dataset } from "@vega/shared";
import type { Firestore } from "firebase-admin/firestore";

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

const META_KEYS = new Set(["updatedAt", "fieldUpdatedAt"]);

type StoredDocument = Record<string, unknown> & {
  updatedAt: string;
  fieldUpdatedAt: Record<string, string>;
};

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
      const prior = priorSnap.exists ? (priorSnap.data() as StoredDocument) : null;
      const stamped = stampChangedFields(prior, record as Record<string, unknown>, now());
      await ref.set(stamped);
      return stamped as StoredEntity<C>;
    },
    async remove(id) {
      await col.doc(id).delete();
    },
  };
}

/** Re-stamp `fieldUpdatedAt` only for fields whose value changed; bump `updatedAt` only on a real change. */
function stampChangedFields(
  prior: StoredDocument | null,
  incoming: Record<string, unknown>,
  now: string,
): StoredDocument {
  const data = stripMeta(incoming);
  const priorData = prior ? stripMeta(prior) : {};
  const fieldUpdatedAt: Record<string, string> = { ...(prior?.fieldUpdatedAt ?? {}) };

  let hasChange = prior === null;
  for (const key of Object.keys(data)) {
    if (!isSameValue(data[key], priorData[key])) {
      fieldUpdatedAt[key] = now;
      hasChange = true;
    }
  }

  const updatedAt = hasChange ? now : (prior?.updatedAt ?? now);
  return { ...data, updatedAt, fieldUpdatedAt };
}

function stripMeta(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).filter(([key]) => !META_KEYS.has(key)));
}

function isSameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}
