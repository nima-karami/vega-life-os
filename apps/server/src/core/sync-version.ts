import { FieldValue, type Firestore } from "firebase-admin/firestore";

const syncRef = (firestore: Firestore, uid: string) => firestore.doc(`users/${uid}/meta/sync`);

const readVersionField = (data: unknown): number => {
  const version = (data as { version?: unknown } | undefined)?.version;
  return typeof version === "number" ? version : 0;
};

/**
 * One counter per user, bumped by every write. A polling client reads this single document to ask
 * "did anything change?" — an idle poll costs one read instead of re-reading the ~N-doc dataset.
 */
export async function bumpSyncVersion(firestore: Firestore, uid: string): Promise<void> {
  await syncRef(firestore, uid).set({ version: FieldValue.increment(1) }, { merge: true });
}

/**
 * Bump for a client-facing write and report the exact version it produced, so the writer can skip
 * refetching its own change. Costs one counter read; null means the counter moved but the version
 * is unknown, which the client treats as "someone else wrote".
 */
export async function advanceSyncVersion(
  firestore: Firestore,
  uid: string,
): Promise<number | null> {
  const ref = syncRef(firestore, uid);
  try {
    return await firestore.runTransaction(async (transaction) => {
      const next = readVersionField((await transaction.get(ref)).data()) + 1;
      transaction.set(ref, { version: next }, { merge: true });
      return next;
    });
  } catch {
    await bumpSyncVersion(firestore, uid);
    return null;
  }
}

export async function readSyncVersion(firestore: Firestore, uid: string): Promise<number> {
  return readVersionField((await syncRef(firestore, uid).get()).data());
}
