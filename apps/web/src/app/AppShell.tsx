import { Navigate, useLocation } from "react-router";
import { useTodayISO } from "@/core/lib/clock";
import { useStore } from "@/core/store";
import { cx } from "@/core/ui";
import { RouteUndoBar } from "@/features/cards/RouteUndoBar";
import { isGratitudeRequired } from "@/features/journal";
import { AccountMenu } from "./AccountMenu";
import { BottomNav } from "./BottomNav";
import { OmniTrigger } from "./OmniTrigger";
import { PageTransition } from "./PageTransition";

/** Ramps the last rows of scrolled content into the nav's own opaque band, which sits
 *  directly below it — so the two together always hide the page behind the glyphs. */
const NAV_FADE_RAMP_PX = 32;

export function AppShell() {
  // Subscribing to the live date here re-renders the whole routed subtree at the
  // day rollover, so every todayISO()-derived surface (goal phase, today labels,
  // habit/streak "today", the gratitude gate) refreshes without per-page wiring.
  const today = useTodayISO();
  const gated = useStore((s) => isGratitudeRequired(s.journal, today));
  const { pathname } = useLocation();
  const onToday = pathname === "/" || pathname === "/today";
  // The journal page is allowlisted: gratitude written there satisfies the gate
  // reactively (it reads s.journal), dismissing the overlay with no extra wiring.
  const onJournal = pathname.startsWith("/journal/");
  // /brainwrite bleeds its card under the overlaid nav and insets its own text off the
  // measured band; every other route reserves that band as bottom padding instead.
  const isFullStage = pathname === "/brainwrite";

  // Hard morning gate: every other route bounces to /today's gratitude step.
  if (gated && !onToday && !onJournal) return <Navigate to="/today" replace />;

  // Header (search bar + account menu) is dropped while gated. Keep it a sibling of
  // <main> so <main>'s tree position is stable and TodayPage isn't remounted on toggle.
  return (
    <div className="safe-inset-x safe-pt flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      {!gated && (
        <header className="relative hidden shrink-0 px-4 pt-5 pb-3 sm:block">
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
      <div
        className={cx(
          "relative flex min-h-0 flex-1 flex-col",
          // BottomNav's own band: its h-11 glyph row plus the container's safe-area padding.
          // It shortens the scrollport rather than padding the content, so the overlaid
          // glyphs can never sit over a control the page put near its bottom edge.
          !gated &&
            !isFullStage &&
            "pb-[calc(env(safe-area-inset-bottom)_+_0.875rem_+_2.75rem)] sm:pb-0",
        )}
      >
        <main id="main-content" className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          <PageTransition />
          <RouteUndoBar />
        </main>
        {/* One mount, one position, every route: the band is overlaid rather than in flow,
        so no route change can unmount it and let the outgoing page flash through it. */}
        {!gated && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 sm:hidden">
            <span
              aria-hidden
              style={{ height: NAV_FADE_RAMP_PX }}
              className="block bg-gradient-to-t from-canvas to-canvas/0"
            />
            <BottomNav />
          </div>
        )}
      </div>
    </div>
  );
}
