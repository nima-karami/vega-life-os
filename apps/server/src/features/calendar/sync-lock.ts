import { randomUUID } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";

const LEASE_MS = 30_000;

/** Raised when another stateless instance already holds a uid's sync lease — the caller skips this run. */
export class SyncLockBusyError extends Error {
  constructor(uid: string) {
    super(`sync already in progress for ${uid}`);
    this.name = "SyncLockBusyError";
  }
}

type Lease = { holder: string; acquiredAt: string; expiresAt: number };

/**
 * Serialize a uid's read-modify-write across stateless instances with a Firestore lease doc
 * (`users/{uid}/private/syncLock`), stolen once expired and released in `finally`. An in-memory
 * flag can't hold across Cloud Run, so the durability lives in the doc.
 */
export async function withSyncLock<T>(
  firestore: Firestore,
  uid: string,
  run: () => Promise<T>,
  leaseMs: number = LEASE_MS,
): Promise<T> {
  const ref = firestore.doc(`users/${uid}/private/syncLock`);
  const holder = randomUUID();

  const acquired = await firestore.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const lease = snap.exists ? (snap.data() as Lease) : null;
    if (lease && lease.expiresAt > Date.now()) return false;
    tx.set(ref, {
      holder,
      acquiredAt: new Date().toISOString(),
      expiresAt: Date.now() + leaseMs,
    } satisfies Lease);
    return true;
  });
  if (!acquired) throw new SyncLockBusyError(uid);

  try {
    return await run();
  } finally {
    await firestore.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists && (snap.data() as Lease).holder === holder) tx.delete(ref);
    });
  }
}
