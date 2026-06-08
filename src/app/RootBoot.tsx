import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { useStore } from "@/core/store";
import { CommandBar } from "./CommandBar";
import { EphemeralOverlay } from "./EphemeralOverlay";
import { Toast } from "./Toast";

/** Top-level provider: boots data, applies theme, owns the global ⌘K layer. */
export function RootBoot() {
  const bootstrap = useStore((s) => s.bootstrap);
  const ready = useStore((s) => s.ready);
  const theme = useStore((s) => s.theme);
  const toggleCommand = useStore((s) => s.toggleCommand);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

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

  return (
    <>
      <Outlet />
      <CommandBar />
      <EphemeralOverlay />
      <Toast />
    </>
  );
}
