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
const MENU_EDGE_PAD_PX = 16;

export const computeWidthCap = (viewportWidth: number): number =>
  viewportWidth - 2 * MENU_EDGE_PAD_PX;

// Two placements of a `w`-wide menu plus the three pads around and between them fit once
// `viewport.width >= 2w + 4 * pad`, and then every origin clears the press on `x`.
const clearsOnX = (menuWidth: number, viewportWidth: number): boolean =>
  menuWidth <= viewportWidth / 2 - 2 * MENU_EDGE_PAD_PX;

/**
 * The tallest the panel may be. Half the viewport where `y` has to carry the clearance on its
 * own — that cap costs items, so it is spent only there; a viewport wide enough to hang the menu
 * beside the press keeps every row and only has to fit on screen.
 *
 * Either path can still cut items — a landscape phone at ~568x276 caps at 244, under the 262 a
 * 7-item all-day menu wants — so both rely on the panel scrolling to reach what the cap hid.
 */
export const computeHeightCap = (viewport: MenuSize, menuWidth: number): number =>
  clearsOnX(menuWidth, viewport.width)
    ? viewport.height - 2 * MENU_EDGE_PAD_PX
    : viewport.height / 2 - 2 * MENU_EDGE_PAD_PX;

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
 * nothing. Which axis carries that is the viewport's to decide: `x` clears wherever two menu
 * widths and their pads fit, and below that width only `y` can, so `x` may sit under the press.
 *
 * The guarantee holds only while `size` is within `computeWidthCap`/`computeHeightCap`; the caller
 * applies both to the panel before it measures it.
 */
export function placeMenu(origin: MenuPos, size: MenuSize, viewport: MenuSize): MenuPos {
  return {
    x: clampAxis(placeAxis(origin.x, size.width, viewport.width), size.width, viewport.width),
    y: clampAxis(placeAxis(origin.y, size.height, viewport.height), size.height, viewport.height),
  };
}
