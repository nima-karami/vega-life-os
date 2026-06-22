import { Outlet } from "react-router-dom";
import { AccountMenu } from "./AccountMenu";
import { OmniTrigger } from "./OmniTrigger";

/**
 * Full-screen app shell — no TopBar, no NavRow.
 * The command bar layer lives in RootBoot; the always-visible omni trigger and the
 * account avatar live here so they are constant on every route — the command bar is
 * the only way to move between views; the avatar surfaces profile/account anywhere.
 */
export function AppShell() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <header className="relative shrink-0 px-4 pt-5 pb-3">
        <div className="mx-auto w-full max-w-2xl">
          <OmniTrigger />
        </div>
        {/* Pinned to the top-right corner of the window, clear of the command bar. */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2">
          <AccountMenu />
        </div>
      </header>
      <main id="main-content" className="min-h-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
