/**
 * Pure derivation of the GCal sync surface's state.
 *
 * The engine (`calendar-sync`) owns the actual work and persistence; this view
 * only reflects status. Keeping the state machine pure makes it unit-testable
 * without mocking Google Identity Services.
 */

export type SyncPhase =
  | "not-configured"
  | "disconnected"
  | "syncing"
  | "error"
  | "needs-reconnect"
  | "connected";

export interface SyncFlags {
  /** VITE_GOOGLE_CLIENT_ID present (engine `gcalConfigured`). */
  configured: boolean;
  /** Persisted "sync is on" flag (engine `isEnabled()`). */
  enabled: boolean;
  /** A live, unexpired token exists (engine `isCalendarConnected()`). */
  connected: boolean;
  /** A sync/connect run is currently in flight (view-local). */
  busy: boolean;
  /** The last run failed (view-local). */
  error: boolean;
}

/**
 * Resolve the single phase the sync control should show.
 * Precedence: not-configured → busy → error → (enabled && !connected ⇒ reconnect)
 *           → enabled+connected ⇒ connected → otherwise disconnected.
 */
export function deriveSyncPhase(flags: SyncFlags): SyncPhase {
  const { configured, enabled, connected, busy, error } = flags;
  if (!configured) return "not-configured";
  if (busy) return "syncing";
  if (error) return "error";
  if (enabled && !connected) return "needs-reconnect";
  if (enabled && connected) return "connected";
  return "disconnected";
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
export function syncStatusText(phase: SyncPhase): string {
  switch (phase) {
    case "not-configured":
      return "Google Calendar isn’t set up";
    case "disconnected":
      return "Not connected";
    case "syncing":
      return "Syncing…";
    case "error":
      return "Sync failed";
    case "needs-reconnect":
      return "Session expired — reconnect";
    case "connected":
      return "Connected";
  }
}
