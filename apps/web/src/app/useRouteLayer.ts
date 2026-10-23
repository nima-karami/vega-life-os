import { useLayoutEffect, useState } from "react";
import { getAppScroller, MORPH_PROPERTIES } from "@/core/ui";
import { advanceRouteLayer, type MorphDirection, type RouteLayer } from "./route-layer";

const CARRIED_PART_SELECTOR = "[data-morph-fill], [data-morph-disc]";

const listScrollBeforeMorph = new Map<string, number>();

function landOnSwappedPage(direction: MorphDirection, pathname: string) {
  const scroller = getAppScroller();
  if (scroller === null) return;
  if (direction === "open") {
    scroller.scrollTop = 0;
    return;
  }
  const saved = listScrollBeforeMorph.get(pathname);
  listScrollBeforeMorph.delete(pathname);
  if (saved !== undefined) scroller.scrollTop = saved;
}

/**
 * The page layer's key plus the morph's direction, latched while the old page is still
 * on screen. The direction drives `route-morph.css`; the list's scroll is kept so Back
 * lands the disc on its own card.
 */
export function useRouteLayer(pathname: string, carriedPath: string | null): RouteLayer {
  const [layer, setLayer] = useState<RouteLayer>({
    pathname,
    key: 0,
    carriedPath,
    direction: null,
  });
  const next = advanceRouteLayer(layer, pathname, carriedPath);
  if (next !== layer) setLayer(next);

  const { direction } = next;
  const isOnCarriedPage = pathname === next.carriedPath;
  const isSwapped = direction !== null && isOnCarriedPage === (direction === "open");

  useLayoutEffect(() => {
    if (direction === null) return;
    const root = document.documentElement;
    root.dataset.routeMorph = direction;
    return () => {
      delete root.dataset.routeMorph;
      for (const property of MORPH_PROPERTIES) root.style.removeProperty(property);
    };
  }, [direction]);

  // The outgoing and incoming page are captured under different names, so the list can
  // sit above the travelling fill and the page under it. A swap with nothing to land on
  // (a Back React Router replays onto a page without the card) is an orphan: fade only.
  useLayoutEffect(() => {
    if (direction === null) return;
    const root = document.documentElement;
    const hasCarriedPart = document.querySelector(CARRIED_PART_SELECTOR) !== null;
    if (!isSwapped) {
      const scroller = getAppScroller();
      if (direction === "open" && hasCarriedPart && scroller !== null)
        listScrollBeforeMorph.set(pathname, scroller.scrollTop);
      return;
    }
    root.dataset.routeMorphSwapped = "";
    if (hasCarriedPart) landOnSwappedPage(direction, pathname);
    else root.dataset.routeMorphOrphan = "";
    return () => {
      delete root.dataset.routeMorphSwapped;
      delete root.dataset.routeMorphOrphan;
    };
  }, [direction, isSwapped, pathname]);

  return next;
}
