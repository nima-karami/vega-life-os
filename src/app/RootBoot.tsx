import { useEffect, useRef } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { onAuth } from "@/core/auth";
import { useStore } from "@/core/store";
import { isEnabled as gcalEnabled, syncNow } from "@/features/calendar-sync";
import { CommandBar } from "./CommandBar";
import { EphemeralOverlay } from "./EphemeralOverlay";
import { GO_SHORTCUTS } from "./keymap";
import { Onboarding } from "./Onboarding";
import { Shortcuts } from "./Shortcuts";
import { Toast } from "./Toast";

/** Top-level provider: boots data, applies theme, owns the global ⌘K layer. */
export function RootBoot() {
  const bootstrap = useStore((s) => s.bootstrap);
  const ready = useStore((s) => s.ready);
  const theme = useStore((s) => s.theme);
  const accent = useStore((s) => s.accent);
  const onboarded = useStore((s) => s.onboarded);
  const toggleCommand = useStore((s) => s.toggleCommand);
  const navigate = useNavigate();
  const gPending = useRef(false);
  const gTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    // When Firebase is configured, auth state drives which backend is active.
    // When it isn't, onAuth fires once with null and we stay purely local.
    const onAuthChange = useStore.getState().onAuthChange;
    const unsub = onAuth((user) => {
      void onAuthChange(user?.uid ?? null);
    });
    return unsub;
  }, []);

  useEffect(() => {
    // When calendar sync is on, run one silent sync on boot. Non-interactive:
    // if it needs consent it no-ops until the user reconnects from Settings.
    if (!gcalEnabled()) return;
    void syncNow(false).catch(() => {});
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // suppress the native browser context menu app-wide — VEGA owns right-click
  // (our Radix context menus still open). Text fields keep their menu for copy/paste.
  useEffect(() => {
    const onCtx = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest('input, textarea, [contenteditable="true"]')) return;
      e.preventDefault();
    };
    document.addEventListener("contextmenu", onCtx);
    return () => document.removeEventListener("contextmenu", onCtx);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (accent) {
      root.style.setProperty("--color-accent", accent);
      root.style.setProperty("--color-signal", accent);
    } else {
      root.style.removeProperty("--color-accent");
      root.style.removeProperty("--color-signal");
    }
  }, [accent]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggleCommand();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const t = e.target as HTMLElement | null;
      const typing =
        !!t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable);
      if (typing) return;

      const k = e.key;
      const s = useStore.getState();

      if (k === "?") {
        e.preventDefault();
        s.setShortcutsOpen(!s.shortcutsOpen);
        return;
      }
      if (k === "Escape") {
        s.setShortcutsOpen(false);
        s.closeCommand();
        s.setEphemeral(null);
        return;
      }

      if (gPending.current) {
        gPending.current = false;
        const m = GO_SHORTCUTS.find((g) => g.key === k.toLowerCase());
        if (m) {
          e.preventDefault();
          navigate(m.to);
        }
        return;
      }
      const low = k.toLowerCase();
      if (low === "g") {
        gPending.current = true;
        clearTimeout(gTimer.current);
        gTimer.current = setTimeout(() => {
          gPending.current = false;
        }, 1500);
        return;
      }
      if (low === "n") {
        e.preventDefault();
        s.openCommand();
        return;
      }
      if (low === "t") {
        e.preventDefault();
        navigate("/");
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleCommand, navigate]);

  if (!ready) {
    return (
      <div className="grid h-screen place-items-center bg-paper">
        <span className="label animate-pulse">// booting vega…</span>
      </div>
    );
  }

  if (!onboarded) return <Onboarding />;

  return (
    <>
      <Outlet />
      <CommandBar />
      <EphemeralOverlay />
      <Shortcuts />
      <Toast />
    </>
  );
}
