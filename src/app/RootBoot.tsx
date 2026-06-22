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

/** Top-level provider: boots data, applies vapor theme, owns the global ⌘K layer. */
export function RootBoot() {
  const bootstrap = useStore((s) => s.bootstrap);
  const ready = useStore((s) => s.ready);
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
    const onAuthChange = useStore.getState().onAuthChange;
    const unsub = onAuth((user) => {
      void onAuthChange(user?.uid ?? null);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!gcalEnabled()) return;
    void syncNow(false).catch(() => {});
  }, []);

  // Apply vapor theme on mount (single theme for this branch)
  useEffect(() => {
    document.documentElement.dataset.theme = "vapor";
  }, []);

  // Custom accent override (store field kept for data-layer reuse, but vapor ignores it by default)
  useEffect(() => {
    const root = document.documentElement;
    if (accent) {
      root.style.setProperty("--color-accent", accent);
    } else {
      root.style.removeProperty("--color-accent");
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
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleCommand, navigate]);

  if (!ready) {
    return (
      <div className="grid h-screen place-items-center bg-background">
        <span className="animate-pulse text-small text-default-500">Booting VEGA…</span>
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
