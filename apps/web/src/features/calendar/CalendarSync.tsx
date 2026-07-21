/**
 * Minimal GCal control for /calendar: a single sync icon (its tone signals state),
 * a show/hide toggle for Google events, and a subtle "last synced" hint. Connecting
 * and disconnecting live in Settings — this surfaces only once connected. Sync runs
 * server-side; this pulls the latest server truth into the store.
 */
import { useState } from "react";
import { useStore } from "@/core/store";
import { cx, Icon } from "@/core/ui";
import { deriveSyncPhase, formatLastSynced, type SyncPhase } from "./sync-status";

/** Icon tone by phase — calm when healthy, danger when it needs attention. */
const TONE: Record<SyncPhase, string> = {
  "not-configured": "text-muted",
  disconnected: "text-muted",
  syncing: "text-accent",
  "backing-off": "text-muted",
  error: "text-danger",
  "needs-reconnect": "text-danger",
  "needs-upgraded-consent": "text-danger",
  connected: "text-success",
};

const ATTENTION: Partial<Record<SyncPhase, string>> = {
  "backing-off": "Will retry",
  error: "Sync failed",
  "needs-reconnect": "Reconnect",
  "needs-upgraded-consent": "Reconnect",
};

export function CalendarSync() {
  const pushToast = useStore((s) => s.pushToast);
  const gcalStatus = useStore((s) => s.gcalStatus);
  const showGoogle = useStore((s) => s.showGoogleEvents);
  const setShowGoogle = useStore((s) => s.setShowGoogleEvents);
  const [busy, setBusy] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [announce, setAnnounce] = useState("");

  // Only surface on /calendar once connected; connect/disconnect live in Settings.
  if (!gcalStatus?.connected) return null;

  const lastSyncedMs = gcalStatus.lastSyncedAt ? Date.parse(gcalStatus.lastSyncedAt) : null;
  const phase = deriveSyncPhase({
    configured: true,
    enabled: true,
    connected: true,
    busy,
    error: hasError,
    needsReconnect: gcalStatus.needsReauth,
    backingOff: gcalStatus.backoffUntil != null,
  });
  const lastLabel = formatLastSynced(lastSyncedMs);
  const hint =
    ATTENTION[phase] ?? (phase === "connected" && lastLabel ? `Synced ${lastLabel}` : "");

  const sync = async () => {
    setBusy(true);
    setHasError(false);
    setAnnounce("Refreshing…");
    try {
      await useStore.getState().refetchAll();
      await useStore.getState().refreshGcalStatus();
      const message = "Calendar refreshed";
      pushToast(message);
      setAnnounce(message);
    } catch {
      setHasError(true);
      const message = "Refresh failed — check your connection";
      pushToast(message);
      setAnnounce(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-0.5">
      {hint && (
        <span
          className="mr-0.5 hidden text-[11px] text-muted sm:inline"
          title={lastSyncedMs ? new Date(lastSyncedMs).toLocaleString() : undefined}
        >
          {hint}
        </span>
      )}

      <IconToggle
        icon={showGoogle ? "eye" : "eye-off"}
        pressed={showGoogle}
        label={showGoogle ? "Hide Google events" : "Show Google events"}
        onClick={() => setShowGoogle(!showGoogle)}
      />

      <button
        type="button"
        onClick={() => void sync()}
        disabled={busy}
        aria-busy={busy || undefined}
        aria-label="Sync Google Calendar now"
        title={lastLabel ? `Synced ${lastLabel}` : "Sync now"}
        className={cx(
          "rounded-[8px] p-1.5 transition-colors hover:bg-surface-secondary",
          TONE[phase],
        )}
      >
        <Icon name="refresh-cw" size={15} className={cx(busy && "animate-spin")} />
      </button>

      <span className="sr-only" role="status" aria-live="polite">
        {announce}
      </span>
    </div>
  );
}

function IconToggle({
  icon,
  pressed,
  label,
  onClick,
}: {
  icon: "eye" | "eye-off";
  pressed: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      aria-label={label}
      title={label}
      className="rounded-[8px] p-1.5 text-muted transition-colors hover:bg-surface-secondary hover:text-foreground"
    >
      <Icon name={icon} size={15} />
    </button>
  );
}
