import { Navigate, Outlet, useLocation } from "react-router-dom";
import { todayISO } from "@/core/lib/date";
import { useStore } from "@/core/store";
import { gratitudeRequired } from "@/features/journal";
import { AccountMenu } from "./AccountMenu";
import { OmniTrigger } from "./OmniTrigger";

export function AppShell() {
  const gated = useStore((s) => gratitudeRequired(s.journal, todayISO()));
  const { pathname } = useLocation();
  const onToday = pathname === "/" || pathname === "/today";
  // The journal page is allowlisted: gratitude written there satisfies the gate
  // reactively (it reads s.journal), dismissing the overlay with no extra wiring.
  const onJournal = pathname.startsWith("/journal/");

  // Hard morning gate: every other route bounces to /today's gratitude step.
  if (gated && !onToday && !onJournal) return <Navigate to="/today" replace />;

  // Header (search bar + account menu) is dropped while gated. Keep it a sibling of
  // <main> so <main>'s tree position is stable and TodayPage isn't remounted on toggle.
  return (
    <div className="safe-inset-x safe-pt flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      {!gated && (
        <header className="relative shrink-0 px-4 pt-5 pb-3">
          {/* Mobile: search + avatar share one centered, vertically-aligned row with
          breathing room. Desktop (sm+): the avatar floats at the far right while the
          search stays centered. */}
          <div className="mx-auto flex w-full max-w-2xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <OmniTrigger />
            </div>
            <div className="shrink-0 sm:absolute sm:right-4 sm:top-1/2 sm:-translate-y-1/2">
              <AccountMenu />
            </div>
          </div>
        </header>
      )}
      <main id="main-content" className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
