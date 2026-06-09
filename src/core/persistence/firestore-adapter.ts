import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  serverTimestamp,
  type Firestore,
} from "firebase/firestore";
import {
  type PersistenceAdapter,
  type Dataset,
  type CollectionName,
  type CollectionSnapshot,
  COLLECTIONS,
  emptyDataset,
} from "./adapter";

const stripMeta = <T,>(data: Record<string, unknown>): T => {
  const { _updatedAt, ...rest } = data;
  void _updatedAt;
  return rest as T;
};

/** Firestore-backed adapter. Source of truth when the user is signed in. */
export class FirestoreAdapter implements PersistenceAdapter {
  constructor(private db: Firestore, private uid: string) {}

  private colRef(col: CollectionName) {
    return collection(this.db, "users", this.uid, col);
  }

  async init(): Promise<void> {
    /* Firestore initializes lazily; nothing to do. */
  }

  async isEmpty(): Promise<boolean> {
    const snap = await getDocs(this.colRef("values"));
    return snap.empty;
  }

  async loadAll(): Promise<Dataset> {
    const out = emptyDataset();
    await Promise.all(
      COLLECTIONS.map(async (col) => {
        const snap = await getDocs(this.colRef(col));
        (out[col] as unknown[]) = snap.docs.map((d) => stripMeta(d.data()));
      }),
    );
    return out;
  }

  async put<C extends CollectionName>(col: C, item: Dataset[C][number]): Promise<void> {
    const id = (item as { id: string }).id;
    await setDoc(doc(this.colRef(col), id), { ...item, _updatedAt: serverTimestamp() });
  }

  async bulkPut<C extends CollectionName>(col: C, items: Dataset[C]): Promise<void> {
    // Firestore batches cap at 500 ops; chunk to be safe.
    for (let i = 0; i < items.length; i += 450) {
      const batch = writeBatch(this.db);
      for (const item of items.slice(i, i + 450)) {
        const id = (item as { id: string }).id;
        batch.set(doc(this.colRef(col), id), { ...item, _updatedAt: serverTimestamp() });
      }
      await batch.commit();
    }
  }

  async remove(col: CollectionName, id: string): Promise<void> {
    await deleteDoc(doc(this.colRef(col), id));
  }

  async clearAll(): Promise<void> {
    await Promise.all(
      COLLECTIONS.map(async (col) => {
        const snap = await getDocs(this.colRef(col));
        for (let i = 0; i < snap.docs.length; i += 450) {
          const batch = writeBatch(this.db);
          for (const d of snap.docs.slice(i, i + 450)) batch.delete(d.ref);
          await batch.commit();
        }
      }),
    );
  }

  subscribe(onChange: (snap: CollectionSnapshot) => void): () => void {
    const unsubs = COLLECTIONS.map((col) =>
      onSnapshot(this.colRef(col), (qs) => {
        // Ignore local-only optimistic echoes that haven't been written yet:
        // still emit, since store merge is idempotent by id.
        const items = qs.docs.map((d) => stripMeta(d.data()));
        onChange({ col, items } as CollectionSnapshot);
      }),
    );
    return () => unsubs.forEach((u) => u());
  }
}
