import { useLayoutEffect, useState } from "react";
import { getAppScroller, MORPH_FILL_PROPERTIES } from "@/core/ui";
import { advanceRouteLayer, type RouteLayer } from "./route-layer";

const listScrollBeforeMorph = new Map<string, number>();

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
      for (const property of MORPH_FILL_PROPERTIES) root.style.removeProperty(property);
    };
  }, [direction]);

  // The outgoing and incoming page are captured under different names, so the list can
  // sit above the travelling fill and the page under it.
  useLayoutEffect(() => {
    if (!isSwapped) return;
    const root = document.documentElement;
    root.dataset.routeMorphSwapped = "";
    return () => {
      delete root.dataset.routeMorphSwapped;
    };
  }, [isSwapped]);

  useLayoutEffect(() => {
    const scroller = getAppScroller();
    if (scroller === null || direction === null) return;
    if (direction === "back") {
      if (!isOnCarriedPage) scroller.scrollTop = listScrollBeforeMorph.get(pathname) ?? 0;
    } else if (isOnCarriedPage) {
      scroller.scrollTop = 0;
    } else {
      listScrollBeforeMorph.set(pathname, scroller.scrollTop);
    }
  }, [direction, pathname, isOnCarriedPage]);

  return next;
}
