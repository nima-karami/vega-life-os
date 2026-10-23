import { expect, type Page } from "@playwright/test";
import { test } from "./fixtures";
import { DAY_MS, enterApp, gratitudePage, saveGratitude } from "./helpers/app";

/**
 * The daily gratitude page covers whatever route was opened on a day with no gratitude,
 * hides the nav, never traps the keyboard, and lands on that route once answered or skipped.
 */

function noonToday(): number {
  const noon = new Date();
  noon.setHours(12, 0, 0, 0);
  return noon.getTime();
}

const settingsHeading = (page: Page) =>
  page.getByRole("heading", { name: "Settings", level: 1, exact: true });

async function openWithGratitudePage(page: Page, route: string) {
  await page.goto(route);
  await expect(gratitudePage(page)).toBeVisible({ timeout: 20_000 });
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(noonToday());
  await enterApp(page, { keepGratitudePage: true });
});

test("covers the opened route with the nav hidden and lets ⌘K through", async ({ page }) => {
  await openWithGratitudePage(page, "/settings");
  await expect(page).toHaveURL(/\/settings$/);
  await expect(settingsHeading(page)).toHaveCount(0);
  await expect(page.getByTestId("omni-trigger")).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Primary" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();

  await page.keyboard.press("ControlOrMeta+K");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(gratitudePage(page)).toBeVisible();
});

test("Continue with nothing written lands on the opened route and stays skipped until tomorrow", async ({
  page,
}) => {
  await openWithGratitudePage(page, "/settings");
  await gratitudePage(page).getByRole("button", { name: "Continue" }).click();
  await expect(gratitudePage(page)).toBeHidden();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(settingsHeading(page)).toBeVisible();
  await expect(page.getByTestId("omni-trigger")).toHaveCount(1);

  await page.reload();
  await expect(settingsHeading(page)).toBeVisible({ timeout: 20_000 });
  await expect(gratitudePage(page)).toHaveCount(0);

  await page.clock.setFixedTime(noonToday() + DAY_MS);
  await openWithGratitudePage(page, "/settings");
});

test("saving gratitude lands on the opened route and the page stays down", async ({ page }) => {
  await openWithGratitudePage(page, "/settings");
  await saveGratitude(page);
  await expect(page).toHaveURL(/\/settings$/);
  await expect(settingsHeading(page)).toBeVisible();

  await page.reload();
  await expect(settingsHeading(page)).toBeVisible({ timeout: 20_000 });
  await expect(gratitudePage(page)).toHaveCount(0);
});

test("opening the app at / lands on Today once answered", async ({ page }) => {
  await openWithGratitudePage(page, "/");
  await saveGratitude(page);
  await expect(page.getByRole("heading", { name: "Today", level: 1, exact: true })).toBeVisible();
});
