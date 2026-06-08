import { Outlet } from "react-router-dom";
import { TopBar } from "./TopBar";
import { NavRow } from "./NavRow";

/** App chrome: top bar + nav + the active view. Boot/theme/⌘K live in RootBoot. */
export function AppShell() {
  return (
    <div className="hud-grid-bg flex h-screen flex-col bg-paper text-ink">
      <TopBar />
      <NavRow />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
