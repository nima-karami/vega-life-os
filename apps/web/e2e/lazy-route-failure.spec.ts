import { expect, type Page } from "@playwright/test";
import { test } from "./fixtures";
import { enterApp } from "./helpers/app";

/** A lazy route whose chunk fails to load lands on the error screen, never a blank page.
 *  Matches the dev module and the hashed build chunk alike. */
const CALENDAR_CHUNK = /\/CalendarPage(\.tsx|-[\w-]+\.js)(\?|$)/;

async function failCalendarChunk(page: Page) {
  await page.route(CALENDAR_CHUNK, (route) => route.abort());
}

const errorScreen = (page: Page) =>
  page.getByRole("alert").filter({ hasText: "VEGA stopped on an error" });

test("a direct load of a route whose chunk fails shows the error screen", async ({ page }) => {
  await failCalendarChunk(page);
  await page.goto("/calendar");

  await expect(errorScreen(page)).toBeVisible({ timeout: 15_000 });
  await expect(errorScreen(page).getByRole("button", { name: "Reload" })).toBeVisible();
});

test("navigating to a route whose chunk fails shows the error screen", async ({ page }) => {
  await enterApp(page);
  await failCalendarChunk(page);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("g");
  await page.keyboard.press("c");

  await expect(errorScreen(page)).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("main")).toHaveCount(0);
});

test("a lazy route still loads when its chunk is reachable", async ({ page }) => {
  await enterApp(page);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("g");
  await page.keyboard.press("c");

  await expect(page).toHaveURL(/\/calendar$/);
  await expect(page.getByRole("button", { name: "Today" }).first()).toBeVisible();
  await expect(errorScreen(page)).toHaveCount(0);
});
