/**
 * Minimal GCal control for /calendar: a single sync icon (its tone signals state),
 * a show/hide toggle for Google events, and a subtle "last synced" hint. Connecting
 * and disconnecting live in Settings — this surfaces only once connected. Sync runs
 * server-side; this triggers syncNow and pulls the latest server truth into the store.
 */
import { useState } from "react";
import { getTrpcClient } from "@/core/persistence/trpc-client";
import { useStore } from "@/core/store";
import { cx, Icon } from "@/core/ui";
import { describeSyncFailure } from "@/features/calendar-sync/sync-feedback";
import { deriveSyncPhase, formatLastSynced, type SyncPhase } from "./sync-status";

/** Icon tone by phase — calm when healthy, danger when it needs attention. */
const TONE: Record<SyncPhase, string> = {
  unknown: "text-muted",
  disconnected: "text-muted",
  syncing: "text-accent",
  "backing-off": "text-muted",
  error: "text-danger",
  "needs-reconnect": "text-danger",
  "write-calendar-missing": "text-warning",
  connected: "text-success",
};

const ATTENTION: Partial<Record<SyncPhase, string>> = {
  "backing-off": "Will retry",
  error: "Sync failed",
  "needs-reconnect": "Reconnect",
  "write-calendar-missing": "Calendar removed",
};

export function CalendarSync() {
  const pushToast = useStore((s) => s.pushToast);
  const gcalStatus = useStore((s) => s.gcalStatus);
  const showGoogle = useStore((s) => s.showGoogleEvents);
  const setShowGoogle = useStore((s) => s.setShowGoogleEvents);
  const [busy, setBusy] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [announce, setAnnounce] = useState("");

  // Surface on /calendar whenever there's a connection to act on; connect lives in Settings.
  if (!(gcalStatus?.connected || gcalStatus?.needsReauth || gcalStatus?.writeCalendarMissing)) {
    return null;
  }

  const lastSyncedMs = gcalStatus.lastSyncedAt ? Date.parse(gcalStatus.lastSyncedAt) : null;
  const phase = deriveSyncPhase({
    status: gcalStatus,
    busy,
    error: hasError,
    nowIso: new Date().toISOString(),
  });
  const lastLabel = formatLastSynced(lastSyncedMs);
  const hint =
    ATTENTION[phase] ?? (phase === "connected" && lastLabel ? `Synced ${lastLabel}` : "");

  const sync = async () => {
    setBusy(true);
    setHasError(false);
    setAnnounce("Syncing…");
    try {
      const outcome = await getTrpcClient().calendar.syncNow.mutate();
      await useStore.getState().refetchAll();
      await useStore.getState().refreshGcalStatus();
      const reason = "reason" in outcome ? outcome.reason : undefined;
      const message = outcome.synced ? "Calendar synced" : describeSyncFailure(reason);
      pushToast(message);
      setAnnounce(message);
      setHasError(!outcome.synced && reason === "needs_reauth");
    } catch {
      setHasError(true);
      const message = "Sync failed — check your connection";
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
