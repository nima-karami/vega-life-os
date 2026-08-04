import { FieldValue, type Firestore } from "firebase-admin/firestore";

const syncRef = (firestore: Firestore, uid: string) => firestore.doc(`users/${uid}/meta/sync`);

/**
 * One counter per user, bumped by every write. A polling client reads this single document to ask
 * "did anything change?" — an idle poll costs one read instead of re-reading the ~N-doc dataset.
 */
export async function bumpSyncVersion(firestore: Firestore, uid: string): Promise<void> {
  await syncRef(firestore, uid).set({ version: FieldValue.increment(1) }, { merge: true });
}

export async function readSyncVersion(firestore: Firestore, uid: string): Promise<number> {
  const snap = await syncRef(firestore, uid).get();
  const version = (snap.data() as { version?: unknown } | undefined)?.version;
  return typeof version === "number" ? version : 0;
}
