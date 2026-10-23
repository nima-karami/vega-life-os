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

/** Lease timing, injectable so a test can drive the clock and the heartbeat by hand. */
export interface SyncLockTiming {
  leaseMs: number;
  now: () => number;
  /** Start calling `renew` every `intervalMs`; returns the function that stops it. */
  startHeartbeat: (renew: () => Promise<void>, intervalMs: number) => () => void;
}

export function startIntervalHeartbeat(renew: () => Promise<void>, intervalMs: number): () => void {
  const heartbeat = setInterval(() => {
    void renew().catch(() => undefined);
  }, intervalMs);
  heartbeat.unref?.();
  return () => clearInterval(heartbeat);
}

const DEFAULT_TIMING: SyncLockTiming = {
  leaseMs: LEASE_MS,
  now: () => Date.now(),
  startHeartbeat: startIntervalHeartbeat,
};

/** Push `expiresAt` forward while we still hold the lease, so a long run is never seen as expired. */
async function renewLease(
  firestore: Firestore,
  ref: DocumentReference,
  holder: string,
  timing: SyncLockTiming,
): Promise<void> {
  await firestore.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists && (snap.data() as Lease).holder === holder) {
      tx.update(ref, { expiresAt: timing.now() + timing.leaseMs });
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
  timingOverrides: Partial<SyncLockTiming> = {},
): Promise<T> {
  const timing = { ...DEFAULT_TIMING, ...timingOverrides };
  const ref = firestore.doc(`users/${uid}/private/syncLock`);
  const holder = randomUUID();

  const acquired = await firestore.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const lease = snap.exists ? (snap.data() as Lease) : null;
    const now = timing.now();
    if (lease && lease.expiresAt > now) return false;
    tx.set(ref, {
      holder,
      acquiredAt: new Date(now).toISOString(),
      expiresAt: now + timing.leaseMs,
    } satisfies Lease);
    return true;
  });
  if (!acquired) throw new SyncLockBusyError(uid);

  const stopHeartbeat = timing.startHeartbeat(
    () => renewLease(firestore, ref, holder, timing),
    Math.max(1, Math.floor(timing.leaseMs / 3)),
  );

  try {
    return await run();
  } finally {
    stopHeartbeat();
    await firestore.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists && (snap.data() as Lease).holder === holder) tx.delete(ref);
    });
  }
}
