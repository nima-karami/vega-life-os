import { randomUUID } from "node:crypto";
import type { DocumentReference, Firestore } from "firebase-admin/firestore";

const LEASE_MS = 30_000;

/** Raised when another stateless instance already holds a uid's sync lease — the caller skips this run. */
export class SyncLockBusyError extends Error {
  constructor(uid: string) {
    super(`sync already in progress for ${uid}`);
    this.name = "SyncLockBusyError";
  }
}

type Lease = { holder: string; acquiredAt: string; expiresAt: number };

/** Push `expiresAt` forward while we still hold the lease, so a long run is never seen as expired. */
async function renewLease(
  firestore: Firestore,
  ref: DocumentReference,
  holder: string,
  leaseMs: number,
): Promise<void> {
  await firestore.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists && (snap.data() as Lease).holder === holder) {
      tx.update(ref, { expiresAt: Date.now() + leaseMs });
    }
  });
}

/**
 * Serialize a uid's read-modify-write across stateless instances with a Firestore lease doc
 * (`users/{uid}/private/syncLock`), stolen once expired and released in `finally`. An in-memory
 * flag can't hold across Cloud Run, so the durability lives in the doc. A heartbeat renews the
 * lease while the run is in flight, so a reconcile slower than one lease term is never mistaken
 * for expired and stolen mid-write.
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

  const heartbeat = setInterval(
    () => {
      void renewLease(firestore, ref, holder, leaseMs).catch(() => undefined);
    },
    Math.max(1, Math.floor(leaseMs / 3)),
  );
  heartbeat.unref?.();

  try {
    return await run();
  } finally {
    clearInterval(heartbeat);
    await firestore.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists && (snap.data() as Lease).holder === holder) tx.delete(ref);
    });
  }
}
