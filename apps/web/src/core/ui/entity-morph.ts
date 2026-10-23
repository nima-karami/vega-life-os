import { type CSSProperties, createContext, useContext, useLayoutEffect } from "react";
import { matchPath, UNSAFE_ViewTransitionContext, useLocation } from "react-router";

/** The card parts a card → page view transition carries into the page header. */
export const ENTITY_MORPH_STYLE = {
  fill: { viewTransitionName: "entity-fill" },
  icon: { viewTransitionName: "entity-icon" },
  title: { viewTransitionName: "entity-title" },
} satisfies Record<string, CSSProperties>;

const ENTITY_ROUTES = ["/values/:id", "/goals/:id", "/habits/:id"];

const DEFAULT_DISC_RADIUS_PX = 22;

/** True inside a drag-overlay clone, which must never claim a transition name. */
export const DragOverlayContext = createContext(false);

const isEntityRoute = (pathname: string) =>
  ENTITY_ROUTES.some((pattern) => matchPath(pattern, pathname) !== null);

/**
 * The entity path a card → page view transition is carrying, or null when none runs.
 * React Router keeps the card's target as `nextLocation` in both directions (Back
 * replays the pair swapped), and replays on any Back to a path that once started one,
 * so only an entity target counts.
 */
export function useCarriedEntityPath(): string | null {
  const transition = useContext(UNSAFE_ViewTransitionContext);
  const nextPath = transition?.isTransitioning ? transition.nextLocation?.pathname : undefined;
  return nextPath !== undefined && isEntityRoute(nextPath) ? nextPath : null;
}

/** True only for the one card or header whose entity is carried, so each name stays unique. */
export function useIsEntityCarried(path: string | undefined): boolean {
  const carriedPath = useCarriedEntityPath();
  const isOverlay = useContext(DragOverlayContext);
  return !isOverlay && carriedPath !== null && carriedPath === path;
}

export const MORPH_PROPERTIES = [
  "--morph-card-fill",
  "--morph-disc-fill",
  "--morph-disc-radius",
] as const;

/**
 * Publishes a carried value on <html>, where the view-transition pseudo-elements can
 * read it. Left in place on unmount — the old page is gone before the animation starts —
 * and cleared by the page layer when the morph ends.
 */
export function usePublishedMorphFill(
  property: (typeof MORPH_PROPERTIES)[number],
  fill: string | undefined,
  isCarried: boolean,
) {
  useLayoutEffect(() => {
    if (isCarried && fill !== undefined) document.documentElement.style.setProperty(property, fill);
  }, [property, fill, isCarried]);
}

/** The disc's own corner radius, so the fill lands on a round or a rounded-square disc. */
function publishDiscRadius(wrapper: HTMLElement | null) {
  const disc = wrapper?.querySelector("svg")?.parentElement;
  if (!disc) return;
  const { width } = disc.getBoundingClientRect();
  const radius = Number.parseFloat(getComputedStyle(disc).borderTopLeftRadius);
  const landing = Number.isFinite(radius) ? Math.min(radius, width / 2) : DEFAULT_DISC_RADIUS_PX;
  document.documentElement.style.setProperty("--morph-disc-radius", `${landing}px`);
}

/** Props for a page header's disc wrapper and title; `route-morph.css` names the glyph. */
export function useEntityMorphHeader(discFill?: string) {
  const isCarried = useIsEntityCarried(useLocation().pathname);
  usePublishedMorphFill("--morph-disc-fill", discFill, isCarried);
  return {
    disc: isCarried
      ? { style: ENTITY_MORPH_STYLE.fill, "data-morph-disc": "", ref: publishDiscRadius }
      : {},
    title: isCarried ? { style: ENTITY_MORPH_STYLE.title } : {},
  };
}
