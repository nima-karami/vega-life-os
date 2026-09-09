export interface MenuPos {
  x: number;
  y: number;
}

export interface MenuSize {
  width: number;
  height: number;
}

// The gap between the press and the menu's nearest *clickable* box: the panel's own 4px padding
// sits inside it, and Blink's touch adjustment reaches ~9px from the contact point.
export const MENU_EDGE_PAD_PX = 16;

const clampAxis = (placed: number, size: number, viewport: number): number =>
  Math.min(
    Math.max(MENU_EDGE_PAD_PX, placed),
    Math.max(MENU_EDGE_PAD_PX, viewport - size - MENU_EDGE_PAD_PX),
  );

const placeAxis = (origin: number, size: number, viewport: number): number => {
  const after = origin + MENU_EDGE_PAD_PX;
  if (after + size <= viewport - MENU_EDGE_PAD_PX) return after;
  const before = origin - size - MENU_EDGE_PAD_PX;
  if (before >= MENU_EDGE_PAD_PX) return before;
  // Neither side clears the press by a full pad, so take the furthest placement that still starts
  // past it — better than letting the clamp drag the flipped menu back across the press.
  return Math.min(after, viewport - size - MENU_EDGE_PAD_PX);
};

/**
 * Where a menu opened at `origin` belongs: inside the viewport, and clear of the press by at least
 * `MENU_EDGE_PAD_PX` on at least one axis, so the release that ends the opening press lands on
 * nothing. Vertical is the guaranteed axis — under two menu widths no horizontal placement can
 * clear the press, so `x` may sit under it.
 *
 * The vertical guarantee holds only while `size.height <= viewport.height / 2 - 2 *
 * MENU_EDGE_PAD_PX` and `size.width <= viewport.width - 2 * MENU_EDGE_PAD_PX`; the panel's
 * `max-h`/`max-w` enforce both.
 */
export function placeMenu(origin: MenuPos, size: MenuSize, viewport: MenuSize): MenuPos {
  return {
    x: clampAxis(placeAxis(origin.x, size.width, viewport.width), size.width, viewport.width),
    y: clampAxis(placeAxis(origin.y, size.height, viewport.height), size.height, viewport.height),
  };
}
