import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { useStore } from "@/core/store";
import { CommandBar } from "./CommandBar";
import { EphemeralOverlay } from "./EphemeralOverlay";
import { Onboarding } from "./Onboarding";
import { Toast } from "./Toast";

/** Top-level provider: boots data, applies theme, owns the global ⌘K layer. */
export function RootBoot() {
  const bootstrap = useStore((s) => s.bootstrap);
  const ready = useStore((s) => s.ready);
  const theme = useStore((s) => s.theme);
  const accent = useStore((s) => s.accent);
  const onboarded = useStore((s) => s.onboarded);
  const toggleCommand = useStore((s) => s.toggleCommand);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

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
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleCommand]);

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
      <Toast />
    </>
  );
}
