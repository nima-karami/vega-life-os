export const AUTO_SCROLL_EDGE_PX = 48;
export const AUTO_SCROLL_MAX_PX_PER_SEC = 600;

const rampVelocity = (depthPx: number) =>
  Math.min(1, depthPx / AUTO_SCROLL_EDGE_PX) * AUTO_SCROLL_MAX_PX_PER_SEC;

/** Signed scroll speed for a pointer at `clientY` against a scroller spanning `top`..`bottom`
 *  in viewport px. Negative scrolls up, positive down, 0 between the two bands. Ramps linearly
 *  with depth into a band and clamps at ±AUTO_SCROLL_MAX_PX_PER_SEC once the pointer leaves. */
export function computeAutoScrollVelocity(
  clientY: number,
  bounds: { top: number; bottom: number },
): number {
  const depthIntoTop = bounds.top + AUTO_SCROLL_EDGE_PX - clientY;
  if (depthIntoTop > 0) return -rampVelocity(depthIntoTop);
  const depthIntoBottom = clientY - (bounds.bottom - AUTO_SCROLL_EDGE_PX);
  if (depthIntoBottom > 0) return rampVelocity(depthIntoBottom);
  return 0;
}
