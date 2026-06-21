import { Outlet } from "react-router-dom";
import { OmniTrigger } from "./OmniTrigger";

/**
 * Full-screen app shell — no TopBar, no NavRow.
 * The command bar layer lives in RootBoot; the always-visible omni trigger lives
 * here so it is constant on every route — it is the only way to move between views.
 */
export function AppShell() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--color-canvas)] text-[var(--color-ink)]">
      <header className="shrink-0 px-4 pt-5 pb-3">
        <div className="mx-auto w-full max-w-2xl">
          <OmniTrigger />
        </div>
      </header>
      <main id="main-content" className="min-h-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
