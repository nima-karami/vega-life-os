import { useLocation } from "react-router";
import { useTodayISO } from "@/core/lib/clock";
import { cx } from "@/core/ui";
import { RouteUndoBar } from "@/features/cards/RouteUndoBar";
import { GratitudeStep, useGratitudePage } from "@/features/journal";
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
  // habit "today", the gratitude page) refreshes without per-page wiring.
  const today = useTodayISO();
  const isGratitudeUp = useGratitudePage(today);
  const { pathname } = useLocation();
  // /brainwrite bleeds its card under the overlaid nav and insets its own text off the
  // measured band; every other route reserves that band as bottom padding instead.
  const isFullStage = pathname === "/brainwrite";

  // The gratitude page covers the opened route in place, so answering it lands there.
  // Header and nav are siblings of <main> so its tree position never moves on toggle.
  return (
    <div className="safe-inset-x safe-pt flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      {!isGratitudeUp && (
        <header className="relative hidden shrink-0 px-4 pt-5 pb-3 sm:block">
          <div className="mx-auto flex w-full max-w-2xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <OmniTrigger />
            </div>
            {/* The centered max-w-2xl row runs under a floated avatar until ~768px; lg is
            the nearest token above that crossover, so the avatar stays in flow until then. */}
            <div className="shrink-0 lg:absolute lg:right-4 lg:top-1/2 lg:-translate-y-1/2">
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
          !isGratitudeUp &&
            !isFullStage &&
            "pb-[calc(env(safe-area-inset-bottom)_+_0.875rem_+_2.75rem)] sm:pb-0",
        )}
      >
        <main id="main-content" className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          {isGratitudeUp ? (
            <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col items-center justify-center px-4 py-6 sm:py-10">
              <GratitudeStep date={today} />
            </div>
          ) : (
            <>
              <PageTransition />
              <RouteUndoBar />
            </>
          )}
        </main>
        {/* One mount, one position, every route: the band is overlaid rather than in flow,
        so no route change can unmount it and let the outgoing page flash through it. */}
        {!isGratitudeUp && (
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
