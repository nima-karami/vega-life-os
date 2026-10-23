import { type CSSProperties, useContext, useLayoutEffect } from "react";
import { UNSAFE_ViewTransitionContext, useLocation } from "react-router";

/** The card parts a card → page view transition carries into the page header. */
export const ENTITY_MORPH_STYLE = {
  fill: { viewTransitionName: "entity-fill" },
  icon: { viewTransitionName: "entity-icon" },
  title: { viewTransitionName: "entity-title" },
} satisfies Record<string, CSSProperties>;

/**
 * The entity path a card → page view transition is carrying, or null when none runs.
 * React Router keeps the card's target as `nextLocation` in both directions (Back
 * replays the pair swapped), so the carried entity is always that path.
 */
export function useCarriedEntityPath(): string | null {
  const transition = useContext(UNSAFE_ViewTransitionContext);
  return transition.isTransitioning ? transition.nextLocation.pathname : null;
}

/** True only for the one card or header whose entity is carried, so each name stays unique. */
export function useIsEntityCarried(path: string | undefined): boolean {
  const carriedPath = useCarriedEntityPath();
  return carriedPath !== null && carriedPath === path;
}

export const MORPH_FILL_PROPERTIES = ["--morph-card-fill", "--morph-disc-fill"] as const;

/**
 * Publishes the carried colour on <html>, where the view-transition pseudo-elements can
 * read it. Left in place on unmount — the old page is gone before the animation starts —
 * and cleared by the page layer when the morph ends.
 */
export function usePublishedMorphFill(
  property: (typeof MORPH_FILL_PROPERTIES)[number],
  fill: string | undefined,
  isCarried: boolean,
) {
  useLayoutEffect(() => {
    if (isCarried && fill !== undefined) document.documentElement.style.setProperty(property, fill);
  }, [property, fill, isCarried]);
}

/** Props for a page header's disc wrapper and title; `route-morph.css` names the glyph. */
export function useEntityMorphHeader(discFill?: string) {
  const isCarried = useIsEntityCarried(useLocation().pathname);
  usePublishedMorphFill("--morph-disc-fill", discFill, isCarried);
  return {
    disc: isCarried ? { style: ENTITY_MORPH_STYLE.fill, "data-morph-disc": "" } : {},
    title: isCarried ? { style: ENTITY_MORPH_STYLE.title } : {},
  };
}
