import { useSyncExternalStore } from "react";
import { useCompact } from "./useCompactModal";

/** The gap a lifted bottom bar keeps above the nav band — the same margin a card face reserves. */
export const NAV_BAR_GAP_PX = 12;

export const NAV_CLEARANCE_FALLBACK_PX = 58;

const listeners = new Set<() => void>();
let navBandHeightPx: number | null = null;

/** Reported by BottomNav. A measured `0` is absence too: at sm+ the band is `sm:hidden`,
 *  so it is present-but-boxless rather than unmounted. */
export function publishNavBandHeight(heightPx: number | null): void {
  const next = heightPx === 0 ? null : heightPx;
  if (next === navBandHeightPx) return;
  navBandHeightPx = next;
  for (const listener of listeners) listener();
}

/** Non-hook read of the same store, for positioning a node that lives outside React. */
export function readNavBandHeight(): number | null {
  return navBandHeightPx;
}

export function subscribeNavBand(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const readAbsentNavBand = () => null;

/** Either signal falsy resolves to absence: crossing 639px the media query and the band's
 *  ResizeObserver disagree for a task, and the un-lifted offset is the safe reading. */
export function resolveNavBandHeight(
  isCompact: boolean,
  bandPx: number | null,
): number | undefined {
  return isCompact && bandPx !== null ? bandPx : undefined;
}

function useNavBandPx(): number | null {
  return useSyncExternalStore(subscribeNavBand, readNavBandHeight, readAbsentNavBand);
}

export interface BottomBarLift {
  className: string;
  style: { bottom?: number };
}

/** The measured band already carries `env(safe-area-inset-bottom)`, so a lifted bar drops
 *  `safe-mb` rather than counting the home indicator twice. */
export function resolveBottomBarLift(
  bandPx: number | undefined,
  gapPx: number = NAV_BAR_GAP_PX,
): BottomBarLift {
  return bandPx === undefined
    ? { className: "safe-mb", style: {} }
    : { className: "", style: { bottom: bandPx + gapPx } };
}

/** Where a viewport-bottom-fixed bar sits: clear of the phone nav band while it is on
 *  screen, otherwise the caller's own `bottom-*` class plus the home-indicator inset. */
export function useBottomBarLift(gapPx: number = NAV_BAR_GAP_PX): BottomBarLift {
  return resolveBottomBarLift(resolveNavBandHeight(useCompact(), useNavBandPx()), gapPx);
}

export function resolveNavClearance(isCompact: boolean, bandPx: number | null): number {
  return resolveNavBandHeight(isCompact, bandPx) ?? NAV_CLEARANCE_FALLBACK_PX;
}

/** The live rendered height of the overlaid bottom nav (including its own safe-area
 *  padding), or NAV_CLEARANCE_FALLBACK_PX while it is unmeasured or off screen. */
export function useNavClearance(): number {
  return resolveNavClearance(useCompact(), useNavBandPx());
}
