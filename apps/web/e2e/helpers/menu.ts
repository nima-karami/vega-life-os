import { expect, type Page } from "@playwright/test";

/**
 * Assertions every long-press context menu owes, wherever it opens.
 *
 * Two separate things are proven here: the menu is placed clear of the press (geometry), and the
 * release that ends the opening press activates nothing (the panel is inert until it lands).
 * Both are guarantees: `placeMenu` holds the panel a full pad off the press on one axis — `x`
 * wherever two menu widths and their pads fit, `y` below that width — so the hit-test probe is a
 * second reading of that promise rather than a stand-in for one.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * What `placeMenu` spends to hold the menu off the press. Re-declared, never imported: importing it
 * would let a mutation to the production constant move this file's goalposts with it.
 */
export const MENU_EDGE_PAD_PX = 16;
// Blink adjusts a touch to the nearest target within ~9px of the contact point. Asserting the
// physical requirement rather than the pad leaves room for the sub-pixel a real box carries.
const TOUCH_ADJUSTMENT_PX = 12;

/** The open menu's box, and the assertion that it stays on screen and off the press that opened it. */
export async function expectMenuClearOf(page: Page, press: Point, viewport: Box): Promise<Box> {
  const menu = await page.getByRole("menu").boundingBox();
  if (menu === null) throw new Error("the open menu has no bounding box");
  expect(menu.x, "the menu overflows the left edge").toBeGreaterThanOrEqual(0);
  expect(menu.y, "the menu overflows the top edge").toBeGreaterThanOrEqual(0);
  expect(menu.x + menu.width, "the menu overflows the right edge").toBeLessThanOrEqual(
    viewport.width,
  );
  expect(menu.y + menu.height, "the menu overflows the bottom edge").toBeLessThanOrEqual(
    viewport.height,
  );
  const clearsOnOneAxis =
    press.x <= menu.x - TOUCH_ADJUSTMENT_PX ||
    press.x >= menu.x + menu.width + TOUCH_ADJUSTMENT_PX ||
    press.y <= menu.y - TOUCH_ADJUSTMENT_PX ||
    press.y >= menu.y + menu.height + TOUCH_ADJUSTMENT_PX;
  expect(clearsOnOneAxis, "the menu opened within a touch adjustment of its own press").toBe(true);
  const pressHitsMenu = await page.evaluate((point) => {
    const hit = document.elementFromPoint(point.x, point.y);
    return hit !== null && hit.closest('[role="menu"]') !== null;
  }, press);
  expect(pressHitsMenu, "the press point hit-tests into the menu").toBe(false);
  return menu;
}

/**
 * Wait out the release's own click before reading the page. `toHaveCount(0)` and `toHaveURL`
 * both pass instantly against current state, so without this an item that fired one frame later
 * would still be scored inert.
 */
export async function settleRelease(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
  await page.waitForTimeout(200);
}

/**
 * Opening a menu must never also run one of its items. `assertNothingRan` carries the surface's
 * own proof — every item closes the menu before it acts, so a still-open menu is necessary but
 * not sufficient.
 */
export async function expectMenuOpenAndInert(page: Page, assertNothingRan: () => Promise<void>) {
  await settleRelease(page);
  await expect(
    page.getByRole("menu"),
    "an item under the press ran and closed the menu",
  ).toBeVisible();
  await expect(page.getByRole("dialog"), "an item under the press opened a dialog").toHaveCount(0);
  await assertNothingRan();
}
