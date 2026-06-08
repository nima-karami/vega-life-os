import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { useStore } from "@/core/store";
import { TopBar } from "./TopBar";
import { NavRow } from "./NavRow";
import { CommandBar } from "./CommandBar";
import { EphemeralOverlay } from "./EphemeralOverlay";
import { Toast } from "./Toast";

export function AppShell() {
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

  return (
    <div className="hud-grid-bg flex h-screen flex-col bg-paper text-ink">
      <TopBar />
      <NavRow />
      <main className="min-h-0 flex-1 overflow-y-auto">
        {ready ? (
          <Outlet />
        ) : (
          <div className="grid h-full place-items-center">
            <span className="label animate-pulse">// booting vega…</span>
          </div>
        )}
      </main>
      <CommandBar />
      <EphemeralOverlay />
      <Toast />
    </div>
  );
}
