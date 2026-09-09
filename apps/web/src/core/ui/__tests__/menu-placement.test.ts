import { describe, expect, it } from "vitest";
import { MENU_EDGE_PAD_PX, type MenuSize, placeMenu } from "../menu-placement";

const PHONE_WIDTHS = [320, 375, 390, 430];
const PHONE_HEIGHTS = [568, 844, 932];
// The row menu (5 items) and the calendar all-day menu (7 items) as they measure in the app.
const MENU_SIZES: MenuSize[] = [
  { width: 180, height: 190 },
  { width: 180, height: 262 },
];

const originsAcross = (span: number): number[] => [
  0,
  MENU_EDGE_PAD_PX,
  Math.round(span / 4),
  Math.round(span / 2),
  Math.round((span * 3) / 4),
  span - MENU_EDGE_PAD_PX,
  span - 1,
];

const coversOrigin = (placed: number, size: number, origin: number): boolean =>
  origin >= placed && origin <= placed + size;

describe("placeMenu", () => {
  for (const viewportWidth of PHONE_WIDTHS) {
    for (const viewportHeight of PHONE_HEIGHTS) {
      for (const size of MENU_SIZES) {
        const viewport = { width: viewportWidth, height: viewportHeight };
        const label = `${viewportWidth}x${viewportHeight}, ${size.width}x${size.height} menu`;

        it(`never covers the press and never leaves the viewport (${label})`, () => {
          for (const x of originsAcross(viewportWidth)) {
            for (const y of originsAcross(viewportHeight)) {
              const placed = placeMenu({ x, y }, size, viewport);
              expect(placed.x, `left edge at (${x},${y})`).toBeGreaterThanOrEqual(MENU_EDGE_PAD_PX);
              expect(placed.y, `top edge at (${x},${y})`).toBeGreaterThanOrEqual(MENU_EDGE_PAD_PX);
              expect(placed.x + size.width, `right edge at (${x},${y})`).toBeLessThanOrEqual(
                viewportWidth - MENU_EDGE_PAD_PX,
              );
              expect(placed.y + size.height, `bottom edge at (${x},${y})`).toBeLessThanOrEqual(
                viewportHeight - MENU_EDGE_PAD_PX,
              );
              const covered =
                coversOrigin(placed.x, size.width, x) && coversOrigin(placed.y, size.height, y);
              expect(covered, `the menu covers the press at (${x},${y})`).toBe(false);
            }
          }
        });
      }
    }
  }

  it("drops a centre press at 320px below the finger, where the flip has no room", () => {
    expect(
      placeMenu({ x: 160, y: 295 }, { width: 180, height: 190 }, { width: 320, height: 568 }),
    ).toEqual({ x: MENU_EDGE_PAD_PX, y: 303 });
  });

  it("hangs a foot-of-list press above and left of the finger", () => {
    expect(
      placeMenu({ x: 376, y: 800 }, { width: 180, height: 190 }, { width: 390, height: 844 }),
    ).toEqual({ x: 188, y: 602 });
  });

  it("keeps the taller all-day menu off a bottom press on the shortest phone", () => {
    const placed = placeMenu(
      { x: 160, y: 540 },
      { width: 180, height: 262 },
      { width: 320, height: 568 },
    );
    expect(placed).toEqual({ x: MENU_EDGE_PAD_PX, y: 270 });
  });

  it("stays on screen when the viewport is too small for any clear placement", () => {
    const placed = placeMenu(
      { x: 160, y: 150 },
      { width: 180, height: 262 },
      { width: 320, height: 320 },
    );
    expect(placed.x).toBeGreaterThanOrEqual(MENU_EDGE_PAD_PX);
    expect(placed.y).toBeGreaterThanOrEqual(MENU_EDGE_PAD_PX);
    expect(placed.x + 180).toBeLessThanOrEqual(320 - MENU_EDGE_PAD_PX);
    expect(placed.y + 262).toBeLessThanOrEqual(320 - MENU_EDGE_PAD_PX);
  });
});
