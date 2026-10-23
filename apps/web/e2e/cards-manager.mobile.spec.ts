import { expect, type Locator, type Page, test } from "@playwright/test";
import { openDeck } from "./helpers/deck";
import {
  type Box,
  expectMenuClearOf,
  expectMenuOpenAndInert,
  MENU_EDGE_PAD_PX,
  type Point,
} from "./helpers/menu";
import { readStoredRows } from "./helpers/stored-rows";
import { cancelTouch, endTouch, longPress, startTouch, swipe, tap } from "./helpers/touch";

/**
 * The deck manager on a phone. The desktop `cards-manager.spec.ts` runs only in the
 * chromium project, so nothing there reaches the compact list, the compact bulk bar or
 * the gallery at a phone track width — the `.mobile.spec.ts` suffix routes this file
 * into the Pixel 7 project instead.
 *
 * There is no loading skeleton to assert: `RootBoot` holds the whole app on its own
 * "Booting VEGA…" screen until the store is ready, so `CardsResults` only ever mounts
 * with the deck already in hand.
 */

const PHONE_WIDTHS = [320, 390];
const PHONE_HEIGHT = 844;
const SHORT_PHONE_HEIGHT = 568;
// 420/2 − 32 leaves a 178px cap, under the 190px five-item row menu — the panel has to scroll here.
const CAPPING_PHONE_HEIGHT = 420;
const MENU_DRAG_INSET_PX = 20;
const MENU_DRAG_DISTANCE_PX = 96;
const CARD_STAGE_WIDTH_PX = 390;
const FACE_SIDE_PADDING_PX = 30;
const LONG_TERM = "counterrevolutionary";
const TOUCH_TARGET_PX = 44;
const CORNER_INSET_PX = 12;
const ROW_PRESS_INSET_PX = 6;
// The band a row-sized-but-not-pressable-sized box leaves dead: only its middle takes a tap.
const ROW_EDGE_INSETS_PX = [3, 8];
const CONTROL_EDGE_INSET_PX = 4;
const FILTER_EDGE_WIDTHS = [320, 390, 430];
// Past the 500ms the row menu waits for, short enough to stay a press and not a drag.
const HOLD_MS = 650;
const BULK_BAR_CONTROLS = [
  "Set category for selection",
  "Set learning for selection",
  "Hide selection",
  "Delete selection",
  "Clear selection",
];

const rows = (page: Page) => page.locator("[data-card-row]");
const tileFace = (page: Page) => page.getByRole("button", { name: /, face$/ }).first();

interface WidthProbe {
  widestPx: number;
  widestTag: string;
  viewportPx: number;
  samples: number;
}

interface TileProbe {
  label: string;
  tileWidthPx: number;
  spillPx: number;
  firstTextLeftInsetPx: number;
  chromeBorderPx: number;
}

/** Hold on one element and expect the row's own five-item menu, wherever the press started. */
async function holdForRowMenu(page: Page, target: Locator) {
  await longPress(page, await centreOf(target));
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem")).toHaveCount(5);
}

/** The open panel's own scroll state — what the height cap bought and what the drag has to move. */
async function measureMenuPanel(page: Page) {
  return page.evaluate(() => {
    const panel = document.querySelector('[role="menu"]');
    if (panel === null) throw new Error("there is no open menu to measure");
    return {
      scrollRangePx: panel.scrollHeight - panel.clientHeight,
      scrollTop: panel.scrollTop,
    };
  });
}

async function dragUpFrom(page: Page, menu: Locator) {
  const box = await menu.boundingBox();
  if (box === null) throw new Error("the open menu has no bounding box");
  const x = box.x + box.width / 2;
  const y = box.y + box.height - MENU_DRAG_INSET_PX;
  await swipe(page, {
    from: { x, y },
    to: { x, y: y - MENU_DRAG_DISTANCE_PX },
    durationMs: 200,
    steps: 8,
  });
}

async function centreOf(target: Locator): Promise<{ x: number; y: number }> {
  const box = await target.boundingBox();
  if (box === null) throw new Error("the touch target has no bounding box");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** The four y's a thumb reaches inside a row that its middle band never covers. */
async function rowEdgePoints(row: Locator): Promise<(Point & { label: string })[]> {
  const box = await row.boundingBox();
  if (box === null) throw new Error("the filter row has no bounding box");
  const x = box.x + box.width / 2;
  return [
    ...ROW_EDGE_INSETS_PX.map((inset) => ({ label: `top + ${inset}`, x, y: box.y + inset })),
    ...ROW_EDGE_INSETS_PX.map((inset) => ({
      label: `bottom - ${inset}`,
      x,
      y: box.y + box.height - inset,
    })),
  ];
}

/** What a thumb at `point` really lands on, and whether that is the row's own pressable label. */
async function probeRowPoint(page: Page, point: Point) {
  return page.evaluate(({ x, y }) => {
    const hit = document.elementFromPoint(x, y);
    const classNames = typeof hit?.className === "string" ? hit.className : "";
    const pressable = hit?.closest("[data-filter-row]")?.querySelector("label") ?? null;
    return {
      hit: hit === null ? "nothing" : `${hit.tagName.toLowerCase()}.${classNames}`.slice(0, 90),
      isOnPressable: pressable !== null && (hit === pressable || pressable.contains(hit)),
    };
  }, point);
}

/** The rim a thumb actually lands on: four corners and four mid-edges, never the safe middle. */
async function controlEdgePoints(target: Locator): Promise<(Point & { label: string })[]> {
  const box = await target.boundingBox();
  if (box === null) throw new Error("the control has no bounding box");
  const left = box.x + CONTROL_EDGE_INSET_PX;
  const right = box.x + box.width - CONTROL_EDGE_INSET_PX;
  const midX = box.x + box.width / 2;
  const top = box.y + CONTROL_EDGE_INSET_PX;
  const bottom = box.y + box.height - CONTROL_EDGE_INSET_PX;
  const midY = box.y + box.height / 2;
  return [
    { label: "top-left", x: left, y: top },
    { label: "top-centre", x: midX, y: top },
    { label: "top-right", x: right, y: top },
    { label: "right-middle", x: right, y: midY },
    { label: "bottom-right", x: right, y: bottom },
    { label: "bottom-centre", x: midX, y: bottom },
    { label: "bottom-left", x: left, y: bottom },
    { label: "left-middle", x: left, y: midY },
  ];
}

/** What a thumb at `point` really lands on, and whether that element is the control itself. */
async function probeControlPoint(page: Page, point: Point, control: Locator) {
  const handle = await control.elementHandle();
  if (handle === null) throw new Error("the control is not attached");
  try {
    return await page.evaluate(
      ({ x, y, control: expected }) => {
        const hit = document.elementFromPoint(x, y);
        const classNames = typeof hit?.className === "string" ? hit.className : "";
        return {
          hit: hit === null ? "nothing" : `${hit.tagName.toLowerCase()}.${classNames}`.slice(0, 90),
          isOnControl: hit === expected,
        };
      },
      { ...point, control: handle },
    );
  } finally {
    await handle.dispose();
  }
}

async function upperCornerOf(target: Locator): Promise<{ x: number; y: number }> {
  const box = await target.boundingBox();
  if (box === null) throw new Error("the touch target has no bounding box");
  return { x: box.x + CORNER_INSET_PX, y: box.y + CORNER_INSET_PX };
}

/** The 44px rail, not the 15px mark: a CDP tap on the mark releases on the rail and never presses. */
async function touchRailCentreOf(target: Locator): Promise<{ x: number; y: number }> {
  return target.evaluate((el) => {
    let node: HTMLElement | null = el as HTMLElement;
    while (node !== null && node.getBoundingClientRect().height < 44) node = node.parentElement;
    const rect = (node ?? (el as HTMLElement)).getBoundingClientRect();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  });
}

/** A held press that ends the way a phone's does: taken over, so the release emits no click. */
async function holdUntilMenu(page: Page, row: Locator) {
  await startTouch(page, await centreOf(row));
  await page.waitForTimeout(HOLD_MS);
  await cancelTouch(page);
  await expect(page.getByRole("menu")).toBeVisible();
  await expect(page.locator("[data-menu-scrim]")).toHaveCount(1);
}

/** Hold the row open, dismiss with Escape, and leave the row ready for the next tap. */
async function holdThenDismiss(page: Page, row: Locator) {
  await holdUntilMenu(page, row);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
}

/**
 * Long-press `press`, then prove the menu opened clear of the finger and that the release the
 * press ends with reached nothing.
 */
async function pressRowAndProbeMenu(page: Page, press: Point, viewport: Box): Promise<Box> {
  const deckSize = await rows(page).count();
  await longPress(page, press);
  await expect(page.getByRole("menu")).toBeVisible();
  const menuBox = await expectMenuClearOf(page, press, viewport);
  await expectMenuOpenAndInert(page, async () => {
    await expect(page.getByText(/\d+ selected/), "Select ran").toHaveCount(0);
    await expect(rows(page), "a row left the list").toHaveCount(deckSize);
    await expect(page, "Open ran and navigated").toHaveURL(/\/cards$/);
  });
  return menuBox;
}

/** The lowest point that still lands on a list row — the press a down-hanging menu would cover. */
async function findLowestRowPress(page: Page): Promise<Point> {
  const point = await page.evaluate((insetPx) => {
    const boxes = [...document.querySelectorAll("[data-card-row]")]
      .map((row) => row.getBoundingClientRect())
      .filter((box) => box.height > 0 && box.top >= 0 && box.bottom <= window.innerHeight)
      .sort((a, b) => b.bottom - a.bottom);
    for (const box of boxes) {
      const x = box.right - insetPx;
      const y = box.bottom - insetPx;
      const hit = document.elementFromPoint(x, y);
      if (hit !== null && hit.closest("[data-card-row]") !== null) return { x, y };
    }
    return null;
  }, ROW_PRESS_INSET_PX);
  if (point === null) throw new Error("no list row is pressable near the foot of the viewport");
  return point;
}

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

async function openGallery(page: Page, width: number) {
  await page.setViewportSize({ width, height: PHONE_HEIGHT });
  await openDeck(page);
  await page.getByRole("button", { name: "Gallery view" }).click();
  await expect(page.getByRole("button", { name: "Gallery view" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
}

/** Every gallery tile, with how far its live face text escapes the tile box. */
async function probeTiles(page: Page): Promise<TileProbe[]> {
  return page.evaluate(() => {
    const tiles = Array.from(document.querySelectorAll("[aria-label]")).filter((el) =>
      /, (face|reveal)$/.test(el.getAttribute("aria-label") ?? ""),
    );
    return tiles.map((tile) => {
      const box = tile.getBoundingClientRect();
      const paragraphs = Array.from(tile.querySelectorAll("p")).filter(
        (paragraph) => paragraph.closest('[aria-hidden="true"]') === null,
      );
      let spillPx = 0;
      for (const paragraph of paragraphs) {
        const rect = paragraph.getBoundingClientRect();
        spillPx = Math.max(
          spillPx,
          box.top - rect.top,
          rect.bottom - box.bottom,
          box.left - rect.left,
          rect.right - box.right,
        );
      }
      const first = paragraphs[0];
      let chromeBorderPx = 0;
      for (let node = first?.parentElement ?? null; node !== null && node !== tile; ) {
        chromeBorderPx += Number.parseFloat(getComputedStyle(node).borderLeftWidth) || 0;
        node = node.parentElement;
      }
      return {
        label: tile.getAttribute("aria-label") ?? "",
        tileWidthPx: box.width,
        spillPx,
        firstTextLeftInsetPx:
          first === undefined ? Number.NaN : first.getBoundingClientRect().left - box.left,
        chromeBorderPx,
      };
    });
  });
}

for (const width of PHONE_WIDTHS) {
  test(`the gallery keeps every face inside its tile at ${width}px`, async ({ page }) => {
    await openGallery(page, width);
    const probes = await probeTiles(page);
    expect(probes.length).toBeGreaterThan(0);

    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
    for (const probe of probes) {
      expect(probe.spillPx, `${probe.label} spills its tile`).toBeLessThanOrEqual(1);
      // The face is laid out for the 390 stage and drawn inside the card chrome's border, so
      // its side padding lands at the scale derived from the tile's content width, not its box.
      expect(probe.chromeBorderPx).toBeGreaterThan(0);
      const faceWidthPx = probe.tileWidthPx - 2 * probe.chromeBorderPx;
      expect(
        Math.abs(
          probe.firstTextLeftInsetPx -
            probe.chromeBorderPx -
            (FACE_SIDE_PADDING_PX * faceWidthPx) / CARD_STAGE_WIDTH_PX,
        ),
        `${probe.label} pads at the derived scale`,
      ).toBeLessThanOrEqual(0.1);
    }
  });
}

async function addVocabularyCard(page: Page, term: string) {
  await page.goto("/cards/new", { waitUntil: "domcontentloaded" });
  await page
    .getByRole("group", { name: "Card type" })
    .getByRole("button", { name: "Vocabulary" })
    .click();
  await page.getByRole("textbox", { name: "Word" }).fill(term);
  await page.getByRole("textbox", { name: "Definition" }).fill("Set against a revolution.");
  await page.getByRole("button", { name: "Save card" }).click();
  await expect(page).toHaveURL(/\/cards\/[^/]+$/);
}

test("a long vocabulary term is fitted inside its gallery tile (390px)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: PHONE_HEIGHT });
  await openDeck(page);
  await addVocabularyCard(page, LONG_TERM);

  await page.goto("/cards", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Gallery view" }).click();
  const tile = page.locator(`[aria-label="${LONG_TERM}, face"]`);
  await expect(tile).toBeVisible({ timeout: 15_000 });

  // The inked text, not the paragraph box — an unfitted term overflows a full-width <p>.
  const spillPx = await tile.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const range = document.createRange();
    let worst = 0;
    for (const paragraph of el.querySelectorAll("p")) {
      if (paragraph.closest('[aria-hidden="true"]') !== null) continue;
      range.selectNodeContents(paragraph);
      const rect = range.getBoundingClientRect();
      worst = Math.max(worst, box.left - rect.left, rect.right - box.right);
    }
    return worst;
  });
  expect(spillPx).toBeLessThanOrEqual(1);
});

test("a long vocabulary term wraps instead of spilling the reveal face (320px)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: PHONE_HEIGHT });
  await openDeck(page);
  await addVocabularyCard(page, LONG_TERM);

  await page.goto("/cards", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Gallery view" }).click();
  const tile = page.locator(`[aria-label="${LONG_TERM}, face"]`);
  await expect(tile).toBeVisible({ timeout: 15_000 });
  await tile.click();

  const reveal = page.locator(`[aria-label="${LONG_TERM}, reveal"]`);
  await expect(reveal).toBeVisible();
  const spillPx = await reveal.evaluate((el) => {
    const box = el.getBoundingClientRect();
    let worst = 0;
    for (const paragraph of el.querySelectorAll("p")) {
      if (paragraph.closest('[aria-hidden="true"]') !== null) continue;
      worst = Math.max(worst, paragraph.scrollWidth - paragraph.clientWidth);
      const rect = paragraph.getBoundingClientRect();
      worst = Math.max(worst, box.left - rect.left, rect.right - box.right);
    }
    return worst;
  });
  expect(spillPx).toBeLessThanOrEqual(1);
});

test("the toolbar's own controls are thumb-sized on a phone (390px)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: PHONE_HEIGHT });
  await openDeck(page);

  for (const label of ["Table view", "Gallery view", "New card"]) {
    const box = await page.getByRole("button", { name: label }).boundingBox();
    if (box === null) throw new Error(`the toolbar control "${label}" has no bounding box`);
    expect(box.height, `${label} is under the touch target`).toBeGreaterThanOrEqual(
      TOUCH_TARGET_PX,
    );
  }

  await page.setViewportSize({ width: 700, height: 900 });
  const wideBox = await page.getByRole("button", { name: "Gallery view" }).boundingBox();
  if (wideBox === null) throw new Error("the wide view toggle has no bounding box");
  expect(wideBox.height, "the desktop toggle grew").toBeLessThan(TOUCH_TARGET_PX);
});

test("the row's own controls are thumb-sized on a phone (390px)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: PHONE_HEIGHT });
  await openDeck(page);

  const row = rows(page).first();
  await expect(row).toBeVisible({ timeout: 15_000 });

  const hideBox = await row.getByRole("button", { name: /^(Hide|Restore) / }).boundingBox();
  if (hideBox === null) throw new Error("the row's hide control has no bounding box");
  expect(hideBox.width, "the hide control is under the touch target").toBeGreaterThanOrEqual(
    TOUCH_TARGET_PX,
  );
  expect(hideBox.height, "the hide control is under the touch target").toBeGreaterThanOrEqual(
    TOUCH_TARGET_PX,
  );

  // The press lands on the checkbox's label, not on the sr-only input the role sits on.
  const selectBox = await row.evaluate((el) => {
    const input = el.querySelector('input[type="checkbox"]');
    const target = input?.closest("label") ?? input;
    if (!target) return null;
    const rect = target.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
  if (selectBox === null) throw new Error("the row's checkbox has no press target");
  expect(selectBox.width, "the checkbox is under the touch target").toBeGreaterThanOrEqual(
    TOUCH_TARGET_PX,
  );
  expect(selectBox.height, "the checkbox is under the touch target").toBeGreaterThanOrEqual(
    TOUCH_TARGET_PX,
  );

  // A thumb landing in the corner of that target — well off the 15px box — must still select.
  await tap(page, { x: selectBox.x + CORNER_INSET_PX / 3, y: selectBox.y + CORNER_INSET_PX / 3 });
  await expect(page.getByText("1 selected")).toBeVisible();
});

test("the compact filter sheet's list fills the sheet (390px)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: PHONE_HEIGHT });
  await openDeck(page);

  await page.getByRole("button", { name: "Filter cards" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Filter cards");

  const scrollerHeightPx = await dialog.evaluate((el) => {
    const row = el.querySelector("[data-filter-row]");
    for (let node = row?.parentElement ?? null; node !== null; node = node.parentElement) {
      if (getComputedStyle(node).overflowY === "auto") return node.getBoundingClientRect().height;
    }
    return 0;
  });
  expect(scrollerHeightPx).toBeGreaterThanOrEqual(0.7 * PHONE_HEIGHT);
});

test("a long press on a list row opens the five row actions and Select picks just that row (390px)", async ({
  page,
}) => {
  const viewport = { x: 0, y: 0, width: 390, height: PHONE_HEIGHT };
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await openDeck(page);

  const row = rows(page).first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  const press = await centreOf(row);
  await longPress(page, press);

  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  await expectMenuClearOf(page, press, viewport);
  const items = menu.getByRole("menuitem");
  await expect(items).toHaveCount(5);
  await expect(items.nth(0)).toHaveText("Open");
  await expect(items.nth(1)).toHaveText("Select");
  await expect(items.nth(2)).toHaveText(/^(Start|Stop) learning$/);
  await expect(items.nth(3)).toHaveText(/^(Hide|Restore)$/);
  await expect(items.nth(4)).toHaveText("Delete");

  await items.nth(1).click();
  await expect(menu).toBeHidden();
  await expect(page.getByText("1 selected")).toBeVisible();
  await expect(row.getByRole("checkbox")).toBeChecked();
  await expect(rows(page).nth(1).getByRole("checkbox")).not.toBeChecked();

  // The bulk bar lands above the list once a row is selected, so the row has moved.
  await longPress(page, await centreOf(row));
  await expect(page.getByRole("menuitem", { name: "Deselect" })).toBeVisible();

  // Dismissing the menu must not leave the row swallowing its next tap (spec §4).
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);

  await row.getByRole("checkbox").click({ force: true });
  await expect(page.getByText("1 selected")).toHaveCount(0);

  await row.getByRole("button", { name: /^Type of / }).click();
  await expect(page.locator(".popover").first().getByRole("option").first()).toBeVisible();
});

test("a long press at the foot of the list opens the menu above it, firing nothing (390px)", async ({
  page,
}) => {
  const viewport = { x: 0, y: 0, width: 390, height: PHONE_HEIGHT };
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await openDeck(page);

  await expect(rows(page).first()).toBeVisible({ timeout: 15_000 });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const press = await findLowestRowPress(page);

  const menuBox = await pressRowAndProbeMenu(page, press, viewport);
  expect(
    press.y + menuBox.height,
    "the press is too high to force the menu to flip up",
  ).toBeGreaterThan(viewport.height - MENU_EDGE_PAD_PX);
});

test("a long press at the right edge opens the menu beside it, firing nothing (390px)", async ({
  page,
}) => {
  const viewport = { x: 0, y: 0, width: 390, height: PHONE_HEIGHT };
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await openDeck(page);

  const row = rows(page).first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  const box = await row.boundingBox();
  if (box === null) throw new Error("the first row has no bounding box");
  const press = { x: box.x + box.width - ROW_PRESS_INSET_PX, y: box.y + box.height / 2 };

  const menuBox = await pressRowAndProbeMenu(page, press, viewport);
  expect(
    press.x + menuBox.width,
    "the press is too far left to force the menu to flip",
  ).toBeGreaterThan(viewport.width - MENU_EDGE_PAD_PX);
  expect(menuBox.x + menuBox.width, "the menu did not flip to the left of the press").toBeLessThan(
    press.x,
  );
});

test("a capped row menu scrolls to its last item instead of dismissing (390x420)", async ({
  page,
}) => {
  const viewport = { x: 0, y: 0, width: 390, height: CAPPING_PHONE_HEIGHT };
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await openDeck(page);

  const row = rows(page).first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  const press = await centreOf(row);
  await longPress(page, press);

  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem")).toHaveCount(5);
  await expectMenuClearOf(page, press, viewport);

  const panel = await measureMenuPanel(page);
  expect(panel.scrollRangePx, "the viewport is too tall to cap a five-item menu").toBeGreaterThan(
    0,
  );
  // A space-taking scrollbar would widen the panel after the cap was read off the narrower box,
  // leaving the placement reasoning about a width the browser no longer draws.
  await expect(menu).toHaveCSS("scrollbar-width", "none");

  await dragUpFrom(page, menu);
  await expect(menu, "the panel's own scroll dismissed it").toBeVisible();
  expect((await measureMenuPanel(page)).scrollTop, "the panel never scrolled").toBeGreaterThan(0);

  await menu.getByRole("menuitem", { name: "Delete" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText(/This removes .+ from the deck/)).toBeVisible();
});

// Placement is the cushion, not the defence. Park the panel over the finger — the one position
// `placeMenu` will never choose — and the release still has to reach nothing.
test("the release that opens the menu fires nothing even from under the panel (390px)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: PHONE_HEIGHT });
  await openDeck(page);

  const row = rows(page).first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  const press = await centreOf(row);
  const deckSize = await rows(page).count();

  await startTouch(page, press);
  await expect(page.getByRole("menu")).toBeVisible({ timeout: 5_000 });
  const probe = await page.evaluate((point) => {
    const panel = document.querySelector('[role="menu"]');
    if (!(panel instanceof HTMLElement)) throw new Error("the menu is not in the document");
    panel.style.transform = `translate(${point.x - 24}px, ${point.y - 12}px)`;
    const rect = panel.getBoundingClientRect();
    const hit = document.elementFromPoint(point.x, point.y);
    return {
      coversPress:
        point.x >= rect.x &&
        point.x <= rect.x + rect.width &&
        point.y >= rect.y &&
        point.y <= rect.y + rect.height,
      pressHitsMenu: hit !== null && hit.closest('[role="menu"]') !== null,
    };
  }, press);
  expect(probe.coversPress, "the probe failed to park the panel over the press").toBe(true);

  await endTouch(page);
  await expectMenuOpenAndInert(page, async () => {
    await expect(page.getByText(/\d+ selected/), "Select ran").toHaveCount(0);
    await expect(rows(page), "a row left the list").toHaveCount(deckSize);
    await expect(page, "Open ran and navigated").toHaveURL(/\/cards$/);
  });
  expect(probe.pressHitsMenu, "the panel was hit-testable while its own press was still down").toBe(
    false,
  );
});

// The band where the flip has nowhere to go and the clamp used to drag the menu back over the
// finger: it opens at every viewport under two menu widths, and the row centre sits in the middle.
test("a long press at a row's centre opens the menu clear of the finger (320px)", async ({
  page,
}) => {
  const viewport = { x: 0, y: 0, width: 320, height: SHORT_PHONE_HEIGHT };
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await openDeck(page);

  const row = rows(page).first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  const press = await centreOf(row);

  const menuBox = await pressRowAndProbeMenu(page, press, viewport);
  expect(press.x, "the press is too far left to be caught by the clamp").toBeGreaterThan(
    viewport.width - MENU_EDGE_PAD_PX - menuBox.width,
  );
  expect(menuBox.x, "the flipped menu was not clamped back across the press").toBeLessThan(press.x);
});

// Neither axis flips here, so the menu's own corner lands nearest the finger. Unpadded, only the
// panel's 5px gutter stood between the press and "Open", and Blink's touch adjustment — the 12px
// contact radius `startTouch` dispatches — reached across it and navigated to the card.
test("a long press at a row's upper-left corner opens the menu clear of the finger (390px)", async ({
  page,
}) => {
  const viewport = { x: 0, y: 0, width: 390, height: PHONE_HEIGHT };
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await openDeck(page);

  const row = rows(page).first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  const box = await row.boundingBox();
  if (box === null) throw new Error("the first row has no bounding box");
  const press = { x: box.x + CORNER_INSET_PX + 2, y: box.y + CORNER_INSET_PX };

  const menuBox = await pressRowAndProbeMenu(page, press, viewport);
  expect(menuBox.x, "the menu flipped left instead of hanging off the press").toBeGreaterThan(
    press.x,
  );
  expect(menuBox.y, "the menu flipped up instead of hanging off the press").toBeGreaterThan(
    press.y,
  );
});

test("the tap after a dismissed row menu reaches the control it lands on (390px)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: PHONE_HEIGHT });
  await openDeck(page);

  const row = rows(page).first();
  await expect(row).toBeVisible({ timeout: 15_000 });

  const selectLabel = await row.getByRole("checkbox").getAttribute("aria-label");
  const cardTitle = (selectLabel ?? "").replace(/^Select /, "");
  expect(cardTitle).not.toBe("");

  // The hide button is the honest probe: it is a plain click handler, so a swallowed click
  // really does stop it — a react-aria control presses without one and would act regardless.
  await holdThenDismiss(page, row);
  await tap(page, await centreOf(row.getByRole("button", { name: `Hide ${cardTitle}` })));
  await expect(row.getByRole("button", { name: `Restore ${cardTitle}` })).toBeVisible();

  await holdThenDismiss(page, row);
  await tap(page, await centreOf(row.getByRole("button", { name: cardTitle, exact: true })));
  await expect(page).toHaveURL(/\/cards\/[^/]+$/);
});

test("a tap while the row menu is open only dismisses it, and the next tap acts (390px)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: PHONE_HEIGHT });
  await openDeck(page);

  const row = rows(page).first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  const chip = row.getByRole("button", { name: /^Type of / });
  const option = page.locator(".popover").first().getByRole("option").first();

  await holdUntilMenu(page, row);
  await tap(page, await centreOf(chip));
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(option).toHaveCount(0);

  await tap(page, await centreOf(chip));
  await expect(option).toBeVisible();
  await page.keyboard.press("Escape");

  await holdUntilMenu(page, row);
  const rail = await touchRailCentreOf(row.getByRole("checkbox"));
  await tap(page, rail);
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(page.getByText("1 selected")).toHaveCount(0);

  await tap(page, rail);
  await expect(page.getByText("1 selected")).toBeVisible();
});

test("a dismissal that never becomes a click arms nothing for later (390px)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: PHONE_HEIGHT });
  await openDeck(page);

  const row = rows(page).first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  const selectLabel = await row.getByRole("checkbox").getAttribute("aria-label");
  const cardTitle = (selectLabel ?? "").replace(/^Select /, "");
  expect(cardTitle).not.toBe("");

  await holdUntilMenu(page, row);
  // Taken over before it lifts: the dismissing touch emits no click of its own, so anything
  // the dismissal armed on the way past is still waiting when the next click arrives.
  await startTouch(page, await centreOf(page.getByRole("searchbox", { name: "Search cards" })));
  await cancelTouch(page);
  await expect(page.getByRole("menu")).toHaveCount(0);

  // A keyboard click arrives with no pointerdown ahead of it to release what the dismissal left.
  await row.getByRole("button", { name: `Hide ${cardTitle}` }).focus();
  await page.keyboard.press("Enter");
  await expect(row.getByRole("button", { name: `Restore ${cardTitle}` })).toBeVisible();
});

// A react-aria pressable stops `pointerdown` before it can bubble, so a press starting on one
// reaches `ContextMenu` only through its capture-phase listener.
test("a long press starting on the checkbox rail opens the row actions (390px)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: PHONE_HEIGHT });
  await openDeck(page);

  const row = rows(page).first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  await holdForRowMenu(page, row.getByRole("checkbox"));
  await expect(page.getByText("1 selected")).toHaveCount(0);
});

test("a long press starting on an attribute chip opens the row actions (390px)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: PHONE_HEIGHT });
  await openDeck(page);

  const row = rows(page).first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  await holdForRowMenu(page, row.getByRole("button", { name: /^Type of / }));
});

test("a long press on a gallery tile opens the same row actions (390px)", async ({ page }) => {
  await openGallery(page, 390);

  const tile = tileFace(page);
  await expect(tile).toBeVisible({ timeout: 15_000 });
  await longPress(page, await centreOf(tile));

  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem")).toHaveCount(5);
  await menu.getByRole("menuitem", { name: "Select" }).click();
  await expect(page.getByText("1 selected")).toBeVisible();
});

test("a tap while a gallery tile's menu is open dismisses it without flipping (390px)", async ({
  page,
}) => {
  await openGallery(page, 390);

  const tile = tileFace(page);
  await expect(tile).toBeVisible({ timeout: 15_000 });
  const faceLabel = (await tile.getAttribute("aria-label")) ?? "";
  expect(faceLabel).not.toBe("");

  await longPress(page, await centreOf(tile));
  await expect(page.getByRole("menu")).toBeVisible();

  // The menu hangs down-right of the press, so the tile's own top corner is outside it.
  await tap(page, await upperCornerOf(tile));
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(page.getByRole("button", { name: faceLabel })).toBeVisible();
});

test("the compact bulk bar keeps its controls on one row and clears the selection (390px)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: PHONE_HEIGHT });
  await openDeck(page);

  const row = rows(page).first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.getByRole("checkbox").click({ force: true });
  await expect(page.getByText("1 selected")).toBeVisible();

  const bar = page.getByText("1 selected").locator("xpath=..");
  const barBox = await bar.boundingBox();
  if (barBox === null) throw new Error("the bulk bar has no bounding box");
  const tops: number[] = [];
  for (const label of BULK_BAR_CONTROLS) {
    const box = await bar.getByRole("button", { name: label }).boundingBox();
    if (box === null) throw new Error(`the bulk bar control "${label}" has no bounding box`);
    tops.push(box.y);
  }
  expect(Math.max(...tops) - Math.min(...tops), "the bulk bar controls wrap").toBeLessThanOrEqual(
    1,
  );
  expect(barBox.height, "the bulk bar is taller than one control row").toBeLessThan(
    2 * TOUCH_TARGET_PX,
  );

  await page.getByRole("button", { name: "Clear selection" }).click();
  await expect(page.getByText("1 selected")).toHaveCount(0);
  await expect(row.getByRole("checkbox")).not.toBeChecked();
});

test("a cold load never draws anything wider than the phone (390px)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: PHONE_HEIGHT });
  await openDeck(page);

  // Every intermediate paint is measured from inside the page: the deck lands from Dexie
  // in a frame or two, far too fast to sample from the test side.
  await page.addInitScript(() => {
    const probed = window as unknown as { widthProbe?: WidthProbe };
    probed.widthProbe = { widestPx: 0, widestTag: "", viewportPx: window.innerWidth, samples: 0 };
    const record = () => {
      const probe = probed.widthProbe;
      if (probe === undefined) return;
      probe.samples += 1;
      for (const el of document.querySelectorAll("*")) {
        const width = el.getBoundingClientRect().width;
        if (width > probe.widestPx) {
          probe.widestPx = width;
          probe.widestTag = `${el.tagName}.${el.className}`.slice(0, 120);
        }
      }
    };
    new MutationObserver(record).observe(document, { childList: true, subtree: true });
  });
  await page.goto("/cards", { waitUntil: "commit" });
  await expect(rows(page).first()).toBeVisible({ timeout: 15_000 });

  const probe = await page.evaluate(
    () => (window as unknown as { widthProbe?: WidthProbe }).widthProbe,
  );
  expect(probe?.samples ?? 0).toBeGreaterThan(0);
  expect(probe?.widestPx, `${probe?.widestTag} overflows the phone`).toBeLessThanOrEqual(
    probe?.viewportPx ?? 0,
  );
});

test("the filter rows are thumb-sized on a phone and unchanged above sm", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: PHONE_HEIGHT });
  await openDeck(page);

  await page.getByRole("button", { name: "Filter cards" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Filter cards");

  const filterRows = dialog.locator("[data-filter-row]");
  const count = await filterRows.count();
  expect(count).toBeGreaterThan(0);
  for (let index = 0; index < count; index += 1) {
    const box = await filterRows.nth(index).boundingBox();
    if (box === null) throw new Error(`filter row ${index} has no bounding box`);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  await expect(filterRows.first().getByText("Note", { exact: true })).toHaveCSS(
    "font-size",
    "15px",
  );
  await expect(dialog.getByText("Visibility", { exact: true })).toHaveCSS("font-size", "12px");

  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 700, height: 900 });
  await page.getByRole("button", { name: "Filter cards" }).click();
  const wideRows = page.locator("[data-filter-row]");
  await expect(wideRows.first()).toBeVisible();
  const wideBox = await wideRows.first().boundingBox();
  if (wideBox === null) throw new Error("the wide filter row has no bounding box");
  expect(wideBox.height).toBeLessThan(44);
  await expect(wideRows.first().getByText("Note", { exact: true })).toHaveCSS(
    "font-size",
    "13.5px",
  );
  await expect(page.getByText("Visibility", { exact: true })).toHaveCSS("font-size", "11px");
});

test("a filter row takes a tap on its top and bottom edges, not only its middle", async ({
  page,
}) => {
  await openDeck(page);

  for (const width of FILTER_EDGE_WIDTHS) {
    await page.setViewportSize({ width, height: PHONE_HEIGHT });
    await page.getByRole("button", { name: "Filter cards" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Filter cards");

    const row = dialog.locator("[data-filter-row]").first();
    const box = row.locator('input[type="checkbox"]');
    for (const point of await rowEdgePoints(row)) {
      const wasChecked = await box.isChecked();
      const probe = await probeRowPoint(page, point);
      expect(probe.isOnPressable, `${width}px, ${point.label}: the tap hits ${probe.hit}`).toBe(
        true,
      );
      await tap(page, point);
      await expect(box, `${width}px, ${point.label} toggled nothing`).toBeChecked({
        checked: !wasChecked,
      });
    }

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  }
});

// Eight rim points, each with a real tap and a state assertion, is more than one 30s test can
// hold for three widths — a width per test keeps every point and its own budget.
for (const width of FILTER_EDGE_WIDTHS) {
  test(`the category filter input takes a tap anywhere on its rim (${width}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: PHONE_HEIGHT });
    await openDeck(page);
    await page.getByRole("button", { name: "Filter cards" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Filter cards");

    const input = dialog.getByRole("textbox", { name: "Filter categories" });
    // The box a thumb aims at is the bordered one, so the rim is measured from the input's
    // container: a smaller input centred inside it is exactly the dead band being ruled out.
    const field = dialog.locator('div:has(> input[aria-label="Filter categories"])');
    const box = await input.boundingBox();
    const fieldBox = await field.boundingBox();
    if (box === null || fieldBox === null)
      throw new Error("the category field has no bounding box");
    expect(box.height, "the category input is under a thumb").toBeGreaterThanOrEqual(
      TOUCH_TARGET_PX,
    );
    expect(fieldBox.height, "the category field is under a thumb").toBeGreaterThanOrEqual(
      TOUCH_TARGET_PX,
    );

    // The dialog contains focus, so `blur()` is undone the moment it lands — park focus on a
    // sibling inside the scope instead, or every tap looks like a hit.
    const elsewhere = dialog.getByRole("button", { name: "Clear", exact: true });
    for (const point of await controlEdgePoints(field)) {
      await elsewhere.focus();
      await expect(input).not.toBeFocused();
      const probe = await probeControlPoint(page, point, input);
      expect(probe.isOnControl, `${point.label}: the tap hits ${probe.hit}`).toBe(true);
      await tap(page, point);
      await expect(input, `${point.label} focused nothing`).toBeFocused();
    }
  });

  test(`the sheet's clear button is thumb-sized and really clears from its rim (${width}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: PHONE_HEIGHT });
    await openDeck(page);
    await page.getByRole("button", { name: "Filter cards" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Filter cards");

    const clear = dialog.getByRole("button", { name: "Clear", exact: true });
    const clearBox = await clear.boundingBox();
    if (clearBox === null) throw new Error("the clear button has no bounding box");
    expect(clearBox.height, "clear is under a thumb").toBeGreaterThanOrEqual(TOUCH_TARGET_PX);
    expect(clearBox.y + clearBox.height, "the footer runs off the sheet").toBeLessThan(
      PHONE_HEIGHT,
    );

    const footer = dialog.getByText(/^\d+ of \d+ cards?$/);
    const unfilteredFooter = (await footer.innerText()).trim();
    const firstRow = dialog.locator("[data-filter-row]").first();
    const firstBox = firstRow.locator('input[type="checkbox"]');

    for (const point of await controlEdgePoints(clear)) {
      await firstRow.locator("label").click();
      await expect(firstBox).toBeChecked();
      await expect(footer).not.toHaveText(unfilteredFooter);

      const probe = await probeControlPoint(page, point, clear);
      expect(probe.isOnControl, `${point.label}: the tap hits ${probe.hit}`).toBe(true);
      await tap(page, point);
      await expect(firstBox, `${point.label} cleared nothing`).not.toBeChecked();
      await expect(footer).toHaveText(unfilteredFooter);
    }
  });
}

test("the grown filter footer still fits the shortest phone (320x568)", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: SHORT_PHONE_HEIGHT });
  await openDeck(page);
  await page.getByRole("button", { name: "Filter cards" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator("[data-filter-row]").first()).toBeVisible();

  const clearBox = await dialog.getByRole("button", { name: "Clear", exact: true }).boundingBox();
  if (clearBox === null) throw new Error("the clear button has no bounding box");
  expect(clearBox.height).toBeGreaterThanOrEqual(TOUCH_TARGET_PX);
  expect(clearBox.y + clearBox.height, "the footer runs off a short phone").toBeLessThan(
    SHORT_PHONE_HEIGHT,
  );
  // The scroller has to keep real room next to the taller footer, not collapse behind it.
  const scrollerHeight = await dialog
    .locator("[data-filter-row]")
    .first()
    .evaluate((row) => (row.parentElement?.parentElement?.clientHeight ?? 0) as number);
  expect(scrollerHeight, "the filter list has no room left").toBeGreaterThan(TOUCH_TARGET_PX * 3);
});

test("the compact branch still reaches both empty states (390px)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: PHONE_HEIGHT });
  await openDeck(page);

  const search = page.getByRole("searchbox", { name: "Search cards" });
  await search.fill("zzzznothingmatchesthis");
  await expect(page.getByText("Nothing matches those filters")).toBeVisible();
  await search.fill("");

  // The list is windowed, so the deck size comes from the stats line, and each row is found by
  // its list index — a tick scrolls the next one into the window.
  const stats = await page.getByText(/^\d+ cards ·/).innerText();
  const total = Number.parseInt(stats, 10);
  expect(total).toBeGreaterThan(0);
  for (let index = 0; index < total; index += 1) {
    await page
      .locator(`[data-card-row][data-index="${index}"]`)
      .getByRole("checkbox")
      .click({ force: true });
  }
  await expect(page.getByText(`${total} selected`)).toBeVisible();

  await page.getByRole("button", { name: "Delete selection" }).click();
  const confirm = page.getByRole("dialog");
  await confirm.getByRole("textbox", { name: "Type delete to confirm" }).fill("delete");
  await confirm.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByText("Write your first card")).toBeVisible();
});

test("the view toggle keeps aria-pressed and the choice survives a reload (390px)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: PHONE_HEIGHT });
  await openDeck(page);

  const table = page.getByRole("button", { name: "Table view" });
  const gallery = page.getByRole("button", { name: "Gallery view" });
  await expect(table).toHaveAttribute("aria-pressed", "true");
  await expect(gallery).toHaveAttribute("aria-pressed", "false");

  await gallery.click();
  await expect(gallery).toHaveAttribute("aria-pressed", "true");
  await expect(table).toHaveAttribute("aria-pressed", "false");
  await expect
    .poll(async () => {
      const prefs = await readStoredRows<{ id: string; view: string }>(page, "cardPrefs");
      return prefs.find((row) => row.id === "feed")?.view;
    })
    .toBe("gallery");

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "Gallery view" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});
