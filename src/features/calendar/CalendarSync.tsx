/**
 * Minimal GCal control for /calendar: a single sync icon (its tone signals state),
 * a show/hide toggle for Google events, and a subtle "last synced" hint. Connecting
 * and disconnecting live in Settings — this surfaces only once connected. It triggers
 * the shipped `calendar-sync` engine; it never forks the reconcile/mapping logic.
 */
import { useState } from "react";
import { useStore } from "@/core/store";
import { cx, Icon } from "@/core/ui";
import {
  gcalConfigured,
  getCalendarToken,
  isCalendarConnected,
  isEnabled,
  syncNow,
} from "@/features/calendar-sync";
import { deriveSyncPhase, formatLastSynced, type SyncPhase } from "./sync-status";

/** Icon tone by phase — calm when healthy, danger when it needs attention. */
const TONE: Record<SyncPhase, string> = {
  "not-configured": "text-muted",
  disconnected: "text-muted",
  syncing: "text-accent",
  error: "text-danger",
  "needs-reconnect": "text-danger",
  "needs-upgraded-consent": "text-danger",
  connected: "text-success",
};

const ATTENTION: Partial<Record<SyncPhase, string>> = {
  error: "Sync failed",
  "needs-reconnect": "Reconnect",
  "needs-upgraded-consent": "Reconnect",
};

export function CalendarSync() {
  const pushToast = useStore((s) => s.pushToast);
  const showGoogle = useStore((s) => s.showGoogleEvents);
  const setShowGoogle = useStore((s) => s.setShowGoogleEvents);
  const [, force] = useState(0);
  const refresh = () => force((n) => n + 1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [lastSynced, setLastSynced] = useState<number | null>(null);
  const [announce, setAnnounce] = useState("");

  const enabled = isEnabled();
  // Only surface on /calendar once connected; connect/disconnect live in Settings.
  if (!gcalConfigured || !enabled) return null;

  const phase = deriveSyncPhase({
    configured: gcalConfigured,
    enabled,
    connected: isCalendarConnected(),
    busy,
    error,
  });
  const needsReconnect = phase === "needs-reconnect" || phase === "needs-upgraded-consent";
  const lastLabel = formatLastSynced(lastSynced);
  const hint =
    ATTENTION[phase] ?? (phase === "connected" && lastLabel ? `Synced ${lastLabel}` : "");

  const sync = async () => {
    setBusy(true);
    setError(false);
    setAnnounce("Syncing…");
    try {
      if (needsReconnect) await getCalendarToken(true); // re-consent first
      const r = await syncNow(true);
      setLastSynced(Date.now());
      const msg = `Synced · ${r.pushed} up, ${r.pulled} down`;
      pushToast(msg);
      setAnnounce(msg);
    } catch {
      setError(true);
      const msg = needsReconnect
        ? "Couldn’t reconnect Google Calendar"
        : "Sync failed — check your connection";
      pushToast(msg);
      setAnnounce(msg);
    } finally {
      setBusy(false);
      refresh();
    }
  };

  return (
    <div className="flex items-center gap-0.5">
      {hint && (
        <span
          className="mr-0.5 hidden text-[11px] text-muted sm:inline"
          title={lastSynced ? new Date(lastSynced).toLocaleString() : undefined}
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
        aria-label={needsReconnect ? "Reconnect Google Calendar" : "Sync Google Calendar now"}
        title={needsReconnect ? "Reconnect" : lastLabel ? `Synced ${lastLabel}` : "Sync now"}
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
