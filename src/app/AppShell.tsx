import { Outlet } from "react-router-dom";

/**
 * Full-screen app shell — no TopBar, no NavRow.
 * The command bar layer lives in RootBoot.
 * The only chrome is the active route + (on /today) the always-visible omni trigger.
 */
export function AppShell() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--color-canvas)] text-[var(--color-ink)]">
      <main id="main-content" className="min-h-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
