import { describe, expect, it } from "vitest";
import { computeHeightCap, computeWidthCap, type MenuSize, placeMenu } from "../menu-placement";

const PHONE_WIDTHS = [320, 360, 390, 430];
// `placeMenu` is fed `window.innerHeight`, not the device height: browser chrome takes ~100px off
// a phone, so the short viewports are the ones the app actually runs at.
const PHONE_HEIGHTS = [420, 454, 500, 568, 844];
// Landscape phones, and the two widths either side of the 424px where two menu widths and their
// pads start to fit — the point where `x` takes over the clearance and the height cap is dropped.
const WIDE_VIEWPORTS: MenuSize[] = [
  { width: 844, height: 390 },
  { width: 932, height: 430 },
  { width: 424, height: 390 },
  { width: 423, height: 390 },
];
// The panel at 5, 6, 7 and 8 items — the row menu is 5, the calendar all-day menu 6 or 7.
const MENU_HEIGHTS = [190, 226, 262, 298];
const MENU_WIDTH = 180;
// Blink adjusts a touch to the nearest target within ~9px of the contact point, and the panel's
// own 4px padding sits inside the item's hit box, so it buys nothing. This is the physical
// requirement — deliberately not `MENU_EDGE_PAD_PX`, which is what the code chose to spend.
const TOUCH_ADJUSTMENT_PX = 12;

/** What the panel's caps guarantee `placeMenu` is handed. */
const asMeasured = (height: number, viewport: MenuSize): MenuSize => {
  const width = Math.min(MENU_WIDTH, computeWidthCap(viewport.width));
  return { width, height: Math.min(height, computeHeightCap(viewport, width)) };
};

/** How far the placed menu stays off the origin — negative when the origin is inside it. */
const clearanceOn = (placed: number, size: number, origin: number): number =>
  Math.max(placed - origin, origin - (placed + size));

interface Failure {
  origin: string;
  reason: string;
}

const findPlacementFault = (
  press: { x: number; y: number },
  size: MenuSize,
  viewport: MenuSize,
): string | null => {
  const placed = placeMenu(press, size, viewport);
  if (placed.x < 0 || placed.y < 0) return "the menu overflows the top or left edge";
  if (placed.x + size.width > viewport.width || placed.y + size.height > viewport.height)
    return "the menu overflows the bottom or right edge";
  const clearance = Math.max(
    clearanceOn(placed.x, size.width, press.x),
    clearanceOn(placed.y, size.height, press.y),
  );
  if (clearance < TOUCH_ADJUSTMENT_PX)
    return "the menu sits within a touch adjustment of the press";
  return null;
};

const failuresAt = (viewport: MenuSize, size: MenuSize): Failure[] => {
  for (let x = 0; x < viewport.width; x += 1) {
    for (let y = 0; y < viewport.height; y += 1) {
      const reason = findPlacementFault({ x, y }, size, viewport);
      if (reason) return [{ origin: `(${x},${y})`, reason }];
    }
  }
  return [];
};

const PORTRAIT_VIEWPORTS: MenuSize[] = PHONE_WIDTHS.flatMap((width) =>
  PHONE_HEIGHTS.map((height) => ({ width, height })),
);

describe("placeMenu", () => {
  for (const viewport of [...PORTRAIT_VIEWPORTS, ...WIDE_VIEWPORTS]) {
    it(`clears every press on the viewport by a full pad (${viewport.width}x${viewport.height})`, () => {
      for (const menuHeight of MENU_HEIGHTS) {
        const size = asMeasured(menuHeight, viewport);
        expect(failuresAt(viewport, size), `${menuHeight}px menu`).toEqual([]);
      }
    });
  }

  it("hangs a top-left press off the press, down and to the right", () => {
    expect(
      placeMenu({ x: 20, y: 30 }, { width: 180, height: 190 }, { width: 390, height: 844 }),
    ).toEqual({ x: 36, y: 46 });
  });

  it("hangs a foot-of-list press above and left of the finger", () => {
    expect(
      placeMenu({ x: 376, y: 800 }, { width: 180, height: 190 }, { width: 390, height: 844 }),
    ).toEqual({ x: 180, y: 594 });
  });

  it("drops a centre press at 320px below the finger, where the flip has no room", () => {
    expect(
      placeMenu({ x: 160, y: 295 }, { width: 180, height: 190 }, { width: 320, height: 568 }),
    ).toEqual({ x: 124, y: 311 });
  });

  it("keeps the capped all-day menu a full pad off the press that broke round three", () => {
    const viewport = { width: 320, height: 454 };
    const size = asMeasured(262, viewport);
    const placed = placeMenu({ x: 157, y: 184 }, size, viewport);
    expect(clearanceOn(placed.y, size.height, 184)).toBeGreaterThanOrEqual(TOUCH_ADJUSTMENT_PX);
  });

  it("spends the halving cap only below the width where the menu can hang beside the press", () => {
    expect(computeHeightCap({ width: 424, height: 390 }, MENU_WIDTH)).toBe(358);
    expect(computeHeightCap({ width: 423, height: 390 }, MENU_WIDTH)).toBe(163);
  });

  it("hands a panel too wide to clear on x back to the height cap, at the 430px margin", () => {
    // 430 clears on x by 3px at 180 wide; the cap is read from the same predicate, so a wider
    // panel loses the x clearance and regains the halved height that lets y carry it.
    const viewport = { width: 430, height: 844 };
    expect(computeHeightCap(viewport, 183)).toBe(812);
    expect(computeHeightCap(viewport, 184)).toBe(390);
    for (const width of [MENU_WIDTH, 183, 184, 240]) {
      const size = { width, height: Math.min(262, computeHeightCap(viewport, width)) };
      expect(failuresAt(viewport, size), `${width}px panel`).toEqual([]);
    }
  });

  it("keeps every item of an 8-item menu on a landscape phone, clear of the press on x", () => {
    const viewport = { width: 844, height: 390 };
    const size = asMeasured(298, viewport);
    expect(size.height, "the menu lost items to a cap the width made unnecessary").toBe(298);
    const placed = placeMenu({ x: 420, y: 195 }, size, viewport);
    expect(clearanceOn(placed.x, size.width, 420)).toBeGreaterThanOrEqual(TOUCH_ADJUSTMENT_PX);
  });

  it("halves an 8-item menu on a narrow phone and clears the press on y instead", () => {
    const viewport = { width: 320, height: 454 };
    const size = asMeasured(298, viewport);
    expect(size.height).toBe(195);
    const placed = placeMenu({ x: 160, y: 227 }, size, viewport);
    expect(clearanceOn(placed.y, size.height, 227)).toBeGreaterThanOrEqual(TOUCH_ADJUSTMENT_PX);
  });

  it("reclaims the strip the flip would have clamped back across the press", () => {
    // 320 wide, 180 menu: x = 124 is the last in-viewport placement that still starts past 118.
    expect(
      placeMenu({ x: 118, y: 40 }, { width: 180, height: 190 }, { width: 320, height: 568 }).x,
    ).toBe(124);
  });
});
