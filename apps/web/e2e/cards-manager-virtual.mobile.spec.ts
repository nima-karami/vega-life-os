import { expect, type Page, test } from "@playwright/test";
import { longDeckTitle, openLongDeck } from "./helpers/deck";

/** The phone list and gallery are windowed too; rows are measured, not assumed, on a phone. */

test.describe.configure({ timeout: 60_000 });

const LONG_DECK = 600;
const WINDOW_CEILING = 50;

const rows = (page: Page) => page.locator("[data-card-row]");
const scroller = (page: Page) => page.locator("main#main-content");

const scrollMainTo = (page: Page, top: number | "bottom") =>
  scroller(page).evaluate((main, target) => {
    main.scrollTop = target === "bottom" ? main.scrollHeight : target;
  }, top);

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
});

test("the phone list mounts a window and reaches the last card (390px)", async ({ page }) => {
  await openLongDeck(page, LONG_DECK);
  expect(await rows(page).count()).toBeLessThan(WINDOW_CEILING);

  await scrollMainTo(page, "bottom");
  const last = rows(page).filter({ hasText: longDeckTitle(LONG_DECK - 1) });
  await expect(last).toBeInViewport();
  await last.getByRole("checkbox").click({ force: true });
  await expect(page.getByText("1 selected")).toBeVisible();
  expect(await rows(page).count()).toBeLessThan(WINDOW_CEILING);

  const overlap = await page.evaluate(() => {
    const boxes = [...document.querySelectorAll("[data-card-row]")]
      .map((row) => row.getBoundingClientRect())
      .sort((a, b) => a.top - b.top);
    return boxes.slice(1).some((box, index) => box.top < boxes[index].bottom - 1);
  });
  expect(overlap, "measured rows never overlap").toBe(false);
});

test("Back from a card returns the phone list to where it was (390px)", async ({ page }) => {
  await openLongDeck(page, LONG_DECK);
  await scrollMainTo(page, 12_000);
  const findRowOnScreen = () =>
    page.evaluate(() => {
      const onScreen = [...document.querySelectorAll("[data-card-row]")].find((row) => {
        const { top } = row.getBoundingClientRect();
        return top > 200 && top < 600;
      });
      return onScreen?.getAttribute("data-card-row") ?? "";
    });
  await expect.poll(findRowOnScreen).not.toBe("");
  const cardId = await findRowOnScreen();
  const target = page.locator(`[data-card-row="${cardId}"]`);
  const title = (await target.getByRole("button").first().innerText()).trim();
  await expect(target).toBeInViewport();
  const leftAt = await scroller(page).evaluate((main) => main.scrollTop);

  await target.getByRole("button", { name: title, exact: true }).click();
  await expect(page).toHaveURL(/\/cards\/c_deck_\d+$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/cards$/);

  await expect(rows(page).filter({ hasText: title })).toBeInViewport();
  const landedAt = await scroller(page).evaluate((main) => main.scrollTop);
  expect(Math.abs(landedAt - leftAt)).toBeLessThan(2);
});

test("the phone gallery windows by rows and reaches its last tile (390px)", async ({ page }) => {
  await openLongDeck(page, LONG_DECK);
  await page.getByRole("button", { name: "Gallery view" }).click();
  const tiles = page.locator("main [aria-label$=', face'], main [aria-label$=', reveal']");
  await expect(tiles.first()).toBeVisible();
  expect(await tiles.count()).toBeLessThan(WINDOW_CEILING);

  await scrollMainTo(page, "bottom");
  await expect(
    page.getByLabel(new RegExp(`^${longDeckTitle(LONG_DECK - 1)}, face$`)),
  ).toBeInViewport();
});
