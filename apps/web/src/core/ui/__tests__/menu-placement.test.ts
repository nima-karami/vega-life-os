import { describe, expect, it } from "vitest";
import { type MenuSize, placeMenu } from "../menu-placement";

const PHONE_WIDTHS = [320, 360, 390, 430];
// `placeMenu` is fed `window.innerHeight`, not the device height: browser chrome takes ~100px off
// a phone, so the short viewports are the ones the app actually runs at.
const PHONE_HEIGHTS = [420, 454, 500, 568, 844];
// The panel at 5, 6, 7 and 8 items — the row menu is 5, the calendar all-day menu 6 or 7.
const MENU_HEIGHTS = [190, 226, 262, 298];
const MENU_WIDTH = 180;
// Blink adjusts a touch to the nearest target within ~9px of the contact point, and the panel's
// own 4px padding sits inside the item's hit box, so it buys nothing. This is the physical
// requirement — deliberately not `MENU_EDGE_PAD_PX`, which is what the code chose to spend.
const TOUCH_ADJUSTMENT_PX = 12;
// The literal 32px is the panel's `max-h-[calc(50dvh_-_32px)]` / `max-w-[calc(100vw_-_32px)]`.
const PANEL_INSET_PX = 32;

/** What the panel's `max-h`/`max-w` guarantee `placeMenu` is handed. */
const asMeasured = (height: number, viewport: MenuSize): MenuSize => ({
  width: Math.min(MENU_WIDTH, viewport.width - PANEL_INSET_PX),
  height: Math.min(height, viewport.height / 2 - PANEL_INSET_PX),
});

/** How far the placed menu stays off the origin — negative when the origin is inside it. */
const clearanceOn = (placed: number, size: number, origin: number): number =>
  Math.max(placed - origin, origin - (placed + size));

interface Failure {
  origin: string;
  reason: string;
}

const failuresAt = (viewport: MenuSize, size: MenuSize): Failure[] => {
  const failures: Failure[] = [];
  for (let x = 0; x < viewport.width; x += 1) {
    for (let y = 0; y < viewport.height; y += 1) {
      const placed = placeMenu({ x, y }, size, viewport);
      const origin = `(${x},${y})`;
      if (placed.x < 0 || placed.y < 0) {
        failures.push({ origin, reason: "the menu overflows the top or left edge" });
      } else if (
        placed.x + size.width > viewport.width ||
        placed.y + size.height > viewport.height
      ) {
        failures.push({ origin, reason: "the menu overflows the bottom or right edge" });
      } else if (
        Math.max(clearanceOn(placed.x, size.width, x), clearanceOn(placed.y, size.height, y)) <
        TOUCH_ADJUSTMENT_PX
      ) {
        failures.push({ origin, reason: "the menu sits within a touch adjustment of the press" });
      }
      if (failures.length > 0) return failures;
    }
  }
  return failures;
};

describe("placeMenu", () => {
  for (const width of PHONE_WIDTHS) {
    for (const height of PHONE_HEIGHTS) {
      const viewport = { width, height };

      it(`clears every press on the viewport by a full pad (${width}x${height})`, () => {
        for (const menuHeight of MENU_HEIGHTS) {
          const size = asMeasured(menuHeight, viewport);
          expect(failuresAt(viewport, size), `${menuHeight}px menu`).toEqual([]);
        }
      });
    }
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

  it("reclaims the strip the flip would have clamped back across the press", () => {
    // 320 wide, 180 menu: x = 124 is the last in-viewport placement that still starts past 118.
    expect(
      placeMenu({ x: 118, y: 40 }, { width: 180, height: 190 }, { width: 320, height: 568 }).x,
    ).toBe(124);
  });
});
