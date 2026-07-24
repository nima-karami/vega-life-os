import { useEffect, useRef } from "react";
import { Outlet, useNavigate } from "react-router";
import { onAuth } from "@/core/auth";
import { todayISO } from "@/core/lib/date";
import { useStore } from "@/core/store";
import { isProfileIncomplete } from "@/core/store/profile";
import { ACCENT_VAR_KEYS, getAccentVars } from "@/core/theme/accent";
import { isGratitudeRequired } from "@/features/journal";
import { CommandBar } from "./CommandBar";
import { EphemeralOverlay } from "./EphemeralOverlay";
import { GO_SHORTCUTS } from "./keymap";
import { Onboarding } from "./Onboarding";
import { ProfileStep } from "./ProfileStep";
import { PwaUpdater } from "./PwaUpdater";
import { Shortcuts } from "./Shortcuts";
import { SignInGate } from "./SignInGate";
import { Toast } from "./Toast";

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

  // Realtime is off: signed-in clients pull server truth when the tab becomes visible
  // + a low-frequency interval, so out-of-band server changes (e.g. calendar reconcile) land.
  useEffect(() => {
    if (!authUid) return;
    const refetch = () => void useStore.getState().refetchAll();
    const onVisible = () => {
      if (document.visibilityState === "visible") refetch();
    };
    document.addEventListener("visibilitychange", onVisible);
    const interval = setInterval(refetch, 5 * 60_000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(interval);
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
    // While the morning gratitude gate is up, swallow every shortcut (incl. ⌘K)
    // so there's no keyboard way around it.
    const gateBlocksKey = (e: KeyboardEvent): boolean => {
      if (!isGratitudeRequired(useStore.getState().journal, todayISO())) return false;
      if (isCommandKey(e)) e.preventDefault();
      return true;
    };

    // "g" then a route key navigates; a lone "g" arms the chord for 1.5s.
    const tryGoChord = (e: KeyboardEvent, key: string): boolean => {
      if (gPending.current) {
        gPending.current = false;
        const target = GO_SHORTCUTS.find((entry) => entry.key === key.toLowerCase());
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
      if (gateBlocksKey(e)) return;
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
