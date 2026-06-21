/**
 * GCal sync surface — a re-skinned (vapor) control over the existing, shipped
 * `calendar-sync` engine. It triggers the engine and reflects status; it never
 * forks the reconcile logic, the Google mapping, or the boot sync (RootBoot).
 *
 * Mirrors the actions in settings/CalendarSettings.tsx, restyled for /calendar.
 */
import { useState } from "react";
import { useStore } from "@/core/store";
import { cx, Icon } from "@/core/ui";
import {
  clearCalendarToken,
  gcalConfigured,
  getCalendarToken,
  isCalendarConnected,
  isEnabled,
  setEnabled,
  syncNow,
} from "@/features/calendar-sync";
import { deriveSyncPhase, formatLastSynced, type SyncPhase, syncStatusText } from "./sync-status";

const DOT: Record<SyncPhase, string> = {
  "not-configured": "bg-[var(--color-muted)]",
  disconnected: "bg-[var(--color-muted)]",
  syncing: "bg-[var(--color-accent)] animate-pulse",
  error: "bg-[#C2622E]",
  "needs-reconnect": "bg-[#C2622E]",
  connected: "bg-[#2F9E74]",
};

export function CalendarSync() {
  const pushToast = useStore((s) => s.pushToast);
  // re-render trigger; the engine owns the real flags via localStorage / token
  const [, force] = useState(0);
  const refresh = () => force((n) => n + 1);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [lastSynced, setLastSynced] = useState<number | null>(null);
  const [announce, setAnnounce] = useState("");

  const phase = deriveSyncPhase({
    configured: gcalConfigured,
    enabled: isEnabled(),
    connected: isCalendarConnected(),
    busy,
    error,
  });

  const lastSyncedLabel = formatLastSynced(lastSynced);
  const statusLine =
    phase === "connected" && lastSyncedLabel ? `Synced ${lastSyncedLabel}` : syncStatusText(phase);

  const runSync = async (label: (r: { pushed: number; pulled: number }) => string) => {
    setBusy(true);
    setError(false);
    setAnnounce("Syncing…");
    try {
      const r = await syncNow(true);
      setLastSynced(Date.now());
      const msg = label(r);
      pushToast(msg);
      setAnnounce(msg);
    } catch {
      setError(true);
      const msg = "Sync failed — check your connection";
      pushToast(msg);
      setAnnounce(msg);
    } finally {
      setBusy(false);
      refresh();
    }
  };

  const connect = async () => {
    setBusy(true);
    setError(false);
    setAnnounce("Connecting…");
    try {
      await getCalendarToken(true); // consent prompt
      setEnabled(true);
      const r = await syncNow(true);
      setLastSynced(Date.now());
      const msg = `Calendar connected — ${r.pushed} up, ${r.pulled} down`;
      pushToast(msg);
      setAnnounce(msg);
    } catch {
      setError(true);
      const msg = "Couldn’t connect Google Calendar";
      pushToast(msg);
      setAnnounce(msg);
    } finally {
      setBusy(false);
      refresh();
    }
  };

  const disconnect = () => {
    clearCalendarToken();
    setEnabled(false);
    setError(false);
    setLastSynced(null);
    pushToast("Calendar disconnected");
    setAnnounce("Disconnected");
    refresh();
  };

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {/* status indicator — text, never color-only; announced politely */}
      <span
        role="status"
        aria-live="polite"
        className="inline-flex items-center gap-1.5 font-sans text-xs text-[var(--color-muted)]"
        title={lastSynced ? new Date(lastSynced).toLocaleString() : undefined}
      >
        <span className={cx("h-1.5 w-1.5 shrink-0 rounded-full", DOT[phase])} aria-hidden="true" />
        {statusLine}
      </span>

      {/* visually-hidden live region for outcome announcements */}
      <span className="sr-only" role="status" aria-live="polite">
        {announce}
      </span>

      {phase === "not-configured" ? null : phase === "disconnected" ? (
        <SyncButton icon="calendar" onClick={() => void connect()} disabled={busy}>
          Connect Google Calendar
        </SyncButton>
      ) : phase === "needs-reconnect" ? (
        <SyncButton icon="calendar" onClick={() => void connect()} disabled={busy}>
          Reconnect
        </SyncButton>
      ) : (
        <>
          <SyncButton
            icon="repeat"
            onClick={() => void runSync((r) => `Synced · ${r.pushed} up, ${r.pulled} down`)}
            disabled={busy}
            busy={busy}
          >
            Sync now
          </SyncButton>
          <SyncButton icon="close" onClick={disconnect} disabled={busy}>
            Disconnect
          </SyncButton>
        </>
      )}
    </div>
  );
}

function SyncButton({
  icon,
  children,
  onClick,
  disabled,
  busy,
}: {
  icon: "calendar" | "repeat" | "close";
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-busy={busy || undefined}
      aria-label={typeof children === "string" ? children : undefined}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border px-3 py-1.5 font-sans text-xs",
        "border-[var(--color-line-strong)] bg-[var(--color-surface)] text-[var(--color-ink)]",
        "transition-colors hover:bg-[var(--color-ink)] hover:text-[var(--color-surface)]",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-[var(--color-surface)] disabled:hover:text-[var(--color-ink)]",
      )}
    >
      <Icon name={icon} size={13} className={cx(busy && "animate-spin")} />
      {children}
    </button>
  );
}
