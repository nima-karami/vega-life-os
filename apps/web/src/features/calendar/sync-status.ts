/**
 * Pure derivation of the GCal sync surface's state from server-owned status.
 *
 * The server owns the sync work and persistence; this only reflects the mirrored
 * `gcalStatus`. Keeping the machine pure makes it unit-testable without a client.
 */
import type { GcalStatus } from "@/features/calendar-sync";

export type SyncPhase =
  | "unknown"
  | "disconnected"
  | "syncing"
  | "backing-off"
  | "error"
  | "needs-reconnect"
  | "write-calendar-missing"
  | "connected";

export interface SyncFlags {
  /** Server status mirror; null before the first status query resolves. */
  status: GcalStatus | null;
  /** A syncNow run is currently in flight (view-local). */
  busy: boolean;
  /** The last run failed (view-local). */
  error: boolean;
  /** Current time as an ISO string, compared against `backoffUntil`. */
  nowIso: string;
}

/**
 * Resolve the single phase the sync control should show.
 * Precedence: unknown → busy → missing-calendar → reauth/disconnected → backing-off
 *           → error → connected.
 */
export function deriveSyncPhase(flags: SyncFlags): SyncPhase {
  const { status, busy, error, nowIso } = flags;
  if (!status) return "unknown";
  if (busy) return "syncing";
  if (status.writeCalendarMissing) return "write-calendar-missing";
  if (status.needsReauth || !status.connected) {
    return status.needsReauth ? "needs-reconnect" : "disconnected";
  }
  if (status.backoffUntil && status.backoffUntil > nowIso) return "backing-off";
  if (error) return "error";
  return "connected";
}

/** Relative "last synced" label, or null when never synced. */
export function formatLastSynced(at: number | null, now: number = Date.now()): string | null {
  if (at == null) return null;
  const diff = Math.max(0, now - at);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

/** Human-readable status copy for a phase (also used for the aria-live region). */
export function formatSyncStatus(phase: SyncPhase): string {
  switch (phase) {
    case "unknown":
      return "Checking sync status…";
    case "disconnected":
      return "Not connected";
    case "syncing":
      return "Syncing…";
    case "backing-off":
      return "Sync paused — will retry";
    case "error":
      return "Sync failed";
    case "needs-reconnect":
      return "Session expired — reconnect";
    case "write-calendar-missing":
      return "VEGA calendar was removed in Google";
    case "connected":
      return "Connected";
  }
}
