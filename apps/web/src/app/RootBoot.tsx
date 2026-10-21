import { useEffect, useRef } from "react";
import { Outlet, useNavigate } from "react-router";
import { onAuth } from "@/core/auth";
import { useStore } from "@/core/store";
import { isProfileIncomplete } from "@/core/store/profile";
import { ACCENT_VAR_KEYS, getAccentVars } from "@/core/theme/accent";
import { CommandBar } from "./CommandBar";
import { EphemeralOverlay } from "./EphemeralOverlay";
import { GO_SHORTCUTS } from "./keymap";
import { Onboarding } from "./Onboarding";
import { ProfileStep } from "./ProfileStep";
import { PwaUpdater } from "./PwaUpdater";
import { filterQuietRoutes } from "./quiet-routes";
import { Shortcuts } from "./Shortcuts";
import { SignInGate } from "./SignInGate";
import { Toast } from "./Toast";

const SYNC_POLL_MS = 5 * 60_000;
// Focus fires on every alt-tab, so a bare refetch-on-focus turns tab-hopping into a burst of pulls.
const SYNC_STALE_MS = 30_000;

const isCommandKey = (e: KeyboardEvent): boolean =>
  (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";

const isTypingTarget = (target: EventTarget | null): boolean => {
  const el = target as HTMLElement | null;
  return (
    !!el &&
    (el.tagName === "INPUT" ||
      el.tagName === "TEXTAREA" ||
      el.tagName === "SELECT" ||
      el.isContentEditable)
  );
};

/** Top-level provider: boots data, applies vapor theme, owns the global ⌘K layer. */
export function RootBoot() {
  const ready = useStore((s) => s.ready);
  const accent = useStore((s) => s.accent);
  const onboarded = useStore((s) => s.onboarded);
  const authUid = useStore((s) => s.authUid);
  const operatorName = useStore((s) => s.operatorName);
  const toggleCommand = useStore((s) => s.toggleCommand);
  const navigate = useNavigate();
  const gPending = useRef(false);
  const gTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const onAuthChange = useStore.getState().onAuthChange;
    const unsub = onAuth((user) => {
      void onAuthChange(user?.uid ?? null);
    });
    return unsub;
  }, []);

  // Realtime is off: signed-in clients pull server truth when the tab becomes visible + a
  // low-frequency poll, so out-of-band server changes (e.g. calendar reconcile) land. The poll is
  // suspended while the tab is hidden — an unattended tab used to re-read the whole account every
  // five minutes indefinitely.
  useEffect(() => {
    if (!authUid) return;
    let lastCheckedAt = Date.now();
    let timer: ReturnType<typeof setInterval> | undefined;

    const check = () => {
      lastCheckedAt = Date.now();
      void useStore.getState().refetchIfChanged();
    };
    const startPolling = () => {
      timer ??= setInterval(check, SYNC_POLL_MS);
    };
    const stopPolling = () => {
      if (timer !== undefined) clearInterval(timer);
      timer = undefined;
    };
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
        return;
      }
      if (Date.now() - lastCheckedAt >= SYNC_STALE_MS) check();
      startPolling();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    if (!document.hidden) startPolling();
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      stopPolling();
    };
  }, [authUid]);

  // Apply vapor theme on mount (single theme for this branch)
  useEffect(() => {
    document.documentElement.dataset.theme = "vapor";
  }, []);

  // Custom accent override — re-tints the whole app by overriding HeroUI's
  // primary scale (buttons, chips, active nav, now-line) plus the legacy
  // --color-accent token. Empty/invalid accent clears the overrides so the
  // configured slate theme shows through.
  useEffect(() => {
    const root = document.documentElement;
    const vars = getAccentVars(accent);
    for (const key of ACCENT_VAR_KEYS) {
      const value = vars[key];
      if (value) root.style.setProperty(key, value);
      else root.style.removeProperty(key);
    }
  }, [accent]);

  // suppress native context menu app-wide
  useEffect(() => {
    const onCtx = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest('input, textarea, [contenteditable="true"]')) return;
      e.preventDefault();
    };
    document.addEventListener("contextmenu", onCtx);
    return () => document.removeEventListener("contextmenu", onCtx);
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    // "g" then a route key navigates; a lone "g" arms the chord for 1.5s.
    const tryGoChord = (e: KeyboardEvent, key: string): boolean => {
      if (gPending.current) {
        gPending.current = false;
        const target = filterQuietRoutes(GO_SHORTCUTS, useStore.getState().quietMode).find(
          (entry) => entry.key === key.toLowerCase(),
        );
        if (target) {
          e.preventDefault();
          navigate(target.to);
        }
        return true;
      }
      if (key.toLowerCase() !== "g") return false;
      gPending.current = true;
      clearTimeout(gTimer.current);
      gTimer.current = setTimeout(() => {
        gPending.current = false;
      }, 1500);
      return true;
    };

    const runShortcut = (e: KeyboardEvent) => {
      const state = useStore.getState();
      const key = e.key;
      if (key === "?") {
        e.preventDefault();
        state.setShortcutsOpen(!state.shortcutsOpen);
        return;
      }
      if (key === "Escape") {
        state.setShortcutsOpen(false);
        state.closeCommand();
        state.setEphemeral(null);
        return;
      }
      if (tryGoChord(e, key)) return;
      if (key.toLowerCase() === "n") {
        e.preventDefault();
        state.openCommand();
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (isCommandKey(e)) {
        e.preventDefault();
        toggleCommand();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      runShortcut(e);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleCommand, navigate]);

  let content: React.ReactNode;
  if (!ready) {
    content = (
      <div className="grid h-dvh place-items-center bg-background">
        <span className="animate-pulse text-sm text-muted">Booting VEGA…</span>
      </div>
    );
  } else if (!authUid && !onboarded) {
    content = <Onboarding />;
  } else if (authUid && isProfileIncomplete(operatorName)) {
    content = <ProfileStep />;
  } else {
    content = (
      <>
        <Outlet />
        <CommandBar />
        <EphemeralOverlay />
        <Shortcuts />
        <SignInGate />
      </>
    );
  }

  return (
    <>
      <PwaUpdater />
      {content}
      <Toast />
    </>
  );
}
