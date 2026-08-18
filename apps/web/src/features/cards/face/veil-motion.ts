import type { CSSProperties } from "react";

/** How long the veil's blur takes to settle over the card. */
export const VEIL_MS = 220;

/** The content waits this long behind the blur's start, so the blur reads as arriving first. */
export const CONTENT_FADE_DELAY_MS = 80;

export const CONTENT_FADE_MS = 200;

const BLUR_RADIUS_PX = 10;

/**
 * The blur radius is the animated value, not a parent's opacity — a browser pops
 * `backdrop-filter` the instant its element paints, so fading a wrapper over it never ramps it.
 */
export function buildVeilBlurStyle(shown: boolean, reduceMotion: boolean): CSSProperties {
  const blur = shown ? `blur(${BLUR_RADIUS_PX}px)` : "blur(0px)";
  return {
    backdropFilter: blur,
    WebkitBackdropFilter: blur,
    transitionDuration: reduceMotion ? "0ms" : `${VEIL_MS}ms`,
  };
}

export function buildVeilContentStyle(shown: boolean, reduceMotion: boolean): CSSProperties {
  const staggers = shown && !reduceMotion;
  return {
    opacity: shown ? 1 : 0,
    transitionDuration: reduceMotion ? "0ms" : `${CONTENT_FADE_MS}ms`,
    transitionDelay: staggers ? `${CONTENT_FADE_DELAY_MS}ms` : "0ms",
  };
}
