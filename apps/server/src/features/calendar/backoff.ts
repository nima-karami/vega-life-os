import type { Firestore } from "firebase-admin/firestore";
import { type GcalAccount, writeGcalAccount } from "./token-store";

export type BackoffState = { failures: number; nextAllowedAt: string };

const BASE_MS = 60_000;
const CAP_MS = 3_600_000;

/** A reconcile skipped because the uid is inside its backoff window — benign, the Scheduler retries. */
export class SyncBackingOffError extends Error {
  constructor() {
    super("sync backing off");
    this.name = "SyncBackingOffError";
  }
}

export function computeNextBackoff(
  failures: number,
  nowMs: number,
  jitter: number = Math.random(),
): BackoffState {
  const raw = Math.min(CAP_MS, BASE_MS * 2 ** failures);
  const delayMs = Math.min(CAP_MS, Math.round(raw * (0.75 + jitter * 0.5)));
  return { failures: failures + 1, nextAllowedAt: new Date(nowMs + delayMs).toISOString() };
}

export function isBackingOff(backoff: BackoffState | null | undefined, nowIso: string): boolean {
  return Boolean(backoff && backoff.nextAllowedAt > nowIso);
}

export async function recordSyncFailure(
  firestore: Firestore,
  uid: string,
  priorFailures: number,
  nowIso: string,
): Promise<BackoffState> {
  const backoff = computeNextBackoff(priorFailures, Date.parse(nowIso));
  await writeGcalAccount(firestore, uid, { backoff });
  return backoff;
}

/** Extend the backoff window on a list-level rate-limit, clear it (and stamp lastSyncedAt) otherwise. */
export function buildBackoffPatch(
  account: Pick<GcalAccount, "backoff">,
  isRateLimited: boolean,
  nowIso: string,
): Pick<GcalAccount, "backoff" | "lastSyncedAt"> {
  if (isRateLimited)
    return { backoff: computeNextBackoff(account.backoff?.failures ?? 0, Date.parse(nowIso)) };
  return { backoff: null, lastSyncedAt: nowIso };
}
