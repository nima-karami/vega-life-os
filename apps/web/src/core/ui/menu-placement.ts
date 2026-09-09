export interface MenuPos {
  x: number;
  y: number;
}

export interface MenuSize {
  width: number;
  height: number;
}

export const MENU_EDGE_PAD_PX = 8;

const clampAxis = (placed: number, size: number, viewport: number): number =>
  Math.min(
    Math.max(MENU_EDGE_PAD_PX, placed),
    Math.max(MENU_EDGE_PAD_PX, viewport - size - MENU_EDGE_PAD_PX),
  );

const isOverOrigin = (placed: number, size: number, origin: number): boolean =>
  origin >= placed && origin <= placed + size;

const placeAxis = (origin: number, size: number, viewport: number): number => {
  const after = origin + MENU_EDGE_PAD_PX;
  return after + size <= viewport - MENU_EDGE_PAD_PX ? after : origin - size - MENU_EDGE_PAD_PX;
};

/**
 * Where a menu opened at `origin` belongs: hanging off the press, inside the viewport, and never
 * over the press itself — a covered press catches its own release and fires the item beneath it.
 */
export function placeMenu(origin: MenuPos, size: MenuSize, viewport: MenuSize): MenuPos {
  const x = clampAxis(placeAxis(origin.x, size.width, viewport.width), size.width, viewport.width);
  const y = clampAxis(
    placeAxis(origin.y, size.height, viewport.height),
    size.height,
    viewport.height,
  );
  if (!isOverOrigin(x, size.width, origin.x) || !isOverOrigin(y, size.height, origin.y)) {
    return { x, y };
  }
  // Under ~2 menu widths the clamp drags the flipped x back over the press; height still has room.
  const above = clampAxis(origin.y - size.height - MENU_EDGE_PAD_PX, size.height, viewport.height);
  const below = clampAxis(origin.y + MENU_EDGE_PAD_PX, size.height, viewport.height);
  return { x, y: isOverOrigin(above, size.height, origin.y) ? below : above };
}
