import { expect, type Page, test } from "@playwright/test";
import { longDeckTitle, openLongDeck } from "./helpers/deck";

/**
 * The manager windows its rows: a long deck mounts a screenful plus overscan, while the scroll
 * height, selection and keyboard order still behave as if every row were there.
 */

// Seeding and reloading a long deck on the dev server outlasts the default 30s.
test.describe.configure({ timeout: 60_000 });

const LONG_DECK = 1500;
const WINDOW_CEILING = 80;

const rows = (page: Page) => page.locator("[data-card-row]");
const rowAt = (page: Page, index: number) => page.locator(`[data-card-row][data-index="${index}"]`);
const scroller = (page: Page) => page.locator("main#main-content");

const scrollMainTo = (page: Page, top: number | "bottom") =>
  scroller(page).evaluate((main, target) => {
    main.scrollTop = target === "bottom" ? main.scrollHeight : target;
  }, top);

const focusedRowIndex = (page: Page) =>
  page.evaluate(() => {
    const row = document.activeElement?.closest("[data-card-row]");
    return row === null || row === undefined ? null : Number(row.getAttribute("data-index"));
  });

test("a long deck mounts a window of rows and still scrolls the whole deck", async ({ page }) => {
  await openLongDeck(page, LONG_DECK);
  expect(await rows(page).count()).toBeLessThan(WINDOW_CEILING);

  const heights = await scroller(page).evaluate((main) => main.scrollHeight);
  expect(heights).toBeGreaterThan(LONG_DECK * 44);

  await scrollMainTo(page, "bottom");
  const last = rowAt(page, LONG_DECK - 1);
  await expect(last).toBeVisible();
  await expect(last).toContainText(longDeckTitle(LONG_DECK - 1));
  expect(await rows(page).count()).toBeLessThan(WINDOW_CEILING);
});

test("the header checkbox selects every filtered card, not only the rendered window", async ({
  page,
}) => {
  await openLongDeck(page, LONG_DECK);
  const matching = LONG_DECK / 4;

  await page.getByRole("searchbox", { name: "Search cards" }).fill("inversion");
  await expect(page.getByText(`${matching} of ${LONG_DECK} cards · filtered`)).toBeVisible();
  expect(await rows(page).count()).toBeLessThan(WINDOW_CEILING);

  const selectAll = page.getByRole("checkbox", { name: "Select every card in view" });
  await selectAll.click({ force: true });
  await expect(page.getByText(`${matching} selected`)).toBeVisible();

  await scrollMainTo(page, "bottom");
  await expect(rows(page).last().getByRole("checkbox")).toBeChecked();

  await page.getByRole("searchbox", { name: "Search cards" }).fill("");
  await expect(page.getByText(`${matching} selected`)).toBeVisible();
  await expect(selectAll).not.toBeChecked();

  await selectAll.click({ force: true });
  await expect(page.getByText(`${LONG_DECK} selected`)).toBeVisible();
  await selectAll.click({ force: true });
  await expect(page.getByText(/\d+ selected/)).toHaveCount(0);
});

test("a row far down the deck ticks, opens its menu and keeps its own state", async ({ page }) => {
  await openLongDeck(page, LONG_DECK);
  await scrollMainTo(page, 30_000);
  const row = rows(page).filter({ hasText: longDeckTitle(700) });
  await expect(row).toBeVisible();

  await row.getByRole("checkbox").click({ force: true });
  await expect(page.getByText("1 selected")).toBeVisible();

  await row.click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: "Deselect" })).toBeVisible();
  await page.keyboard.press("Escape");

  await scrollMainTo(page, 0);
  await expect(rowAt(page, 0)).toBeVisible();
  await scrollMainTo(page, 30_000);
  await expect(row.getByRole("checkbox")).toBeChecked();
});

test("Tab walks on past the rendered window, and a focused row survives a scroll away", async ({
  page,
}) => {
  await openLongDeck(page, LONG_DECK);
  const firstRendered = await rows(page).count();
  await rowAt(page, 0)
    .getByRole("button", { name: longDeckTitle(0), exact: true })
    .focus();

  // Six stops a row: tick, title, three chips, hide.
  for (let press = 0; press < (firstRendered + 6) * 6; press += 1) {
    await page.keyboard.press("Tab");
  }
  const reached = await focusedRowIndex(page);
  expect(reached).not.toBeNull();
  expect(reached ?? 0).toBeGreaterThan(firstRendered);
  await expect(page.locator(":focus")).toBeInViewport();

  await scrollMainTo(page, "bottom");
  await expect(rowAt(page, LONG_DECK - 1)).toBeInViewport();
  expect(await focusedRowIndex(page)).toBe(reached);

  await page.keyboard.press("Shift+Tab");
  expect(await focusedRowIndex(page)).toBe(reached);
});

test("a resized column persists across a reload and the window rows follow the header", async ({
  page,
}) => {
  await openLongDeck(page, LONG_DECK);
  const resizer = page.getByRole("button", { name: "Resize category column" });
  const cellWidth = () =>
    page.evaluate(() => {
      const template = (selector: string) =>
        getComputedStyle(document.querySelector(selector) as HTMLElement).gridTemplateColumns;
      return {
        header: template('[style*="grid-template-columns"]:not([data-card-row])'),
        row: template("[data-card-row]"),
      };
    });
  const before = await cellWidth();

  await resizer.focus();
  for (let step = 0; step < 4; step += 1) await page.keyboard.press("ArrowRight");
  const widened = await cellWidth();
  expect(widened.row).toBe(widened.header);
  expect(widened.row).not.toBe(before.row);

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(rowAt(page, 0)).toBeVisible({ timeout: 20_000 });
  await scrollMainTo(page, 40_000);
  await expect(rows(page).first()).toBeAttached();
  const restored = await cellWidth();
  expect(restored).toEqual(widened);
});

test("Back from a card lands where the list was left", async ({ page }) => {
  await openLongDeck(page, LONG_DECK);
  await scrollMainTo(page, 20_000);
  const title = longDeckTitle(460);
  const row = rows(page).filter({ hasText: title });
  await expect(row).toBeVisible();
  const leftAt = await scroller(page).evaluate((main) => main.scrollTop);

  await row.getByRole("button", { name: title, exact: true }).click();
  await expect(page).toHaveURL(/\/cards\/c_deck_460$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/cards$/);

  await expect(rows(page).filter({ hasText: title })).toBeInViewport();
  const landedAt = await scroller(page).evaluate((main) => main.scrollTop);
  expect(Math.abs(landedAt - leftAt)).toBeLessThan(2);
});

test("the gallery windows a long deck by rows and reaches its last tile", async ({ page }) => {
  await openLongDeck(page, LONG_DECK);
  await page.getByRole("button", { name: "Gallery view" }).click();

  const tiles = page.locator("main [aria-label$=', face'], main [aria-label$=', reveal']");
  await expect(tiles.first()).toBeVisible();
  expect(await tiles.count()).toBeLessThan(WINDOW_CEILING);

  await scrollMainTo(page, "bottom");
  const lastTitle = longDeckTitle(LONG_DECK - 1);
  await expect(page.getByLabel(new RegExp(`^${lastTitle}, face$`))).toBeInViewport();
  expect(await tiles.count()).toBeLessThan(WINDOW_CEILING);
});

test("an empty search over a long deck reads as filtered, and clearing it restores the window", async ({
  page,
}) => {
  await openLongDeck(page, LONG_DECK);
  await scrollMainTo(page, 10_000);
  await page.getByRole("searchbox", { name: "Search cards" }).fill("zzzz-no-such-card");
  await expect(page.getByText("Nothing matches those filters")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(rows(page).first()).toBeVisible();
  expect(await rows(page).count()).toBeLessThan(WINDOW_CEILING);
});
