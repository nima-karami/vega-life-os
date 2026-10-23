import { expect, type Page } from "@playwright/test";
import { test } from "./fixtures";
import { enterApp } from "./helpers/app";

/** A lazy route whose chunk fails reloads once for a fresh index.html, then lands on the
 *  error screen, never a blank page. Matches the dev module and the hashed build chunk. */
const CALENDAR_CHUNK = /\/CalendarPage(\.tsx|-[\w-]+\.js)(\?|$)/;

async function failCalendarChunk(page: Page, { times }: { times: number }) {
  const failures = { count: 0 };
  await page.route(CALENDAR_CHUNK, (route) => {
    if (failures.count >= times) return route.fallback();
    failures.count += 1;
    return route.abort();
  });
  return failures;
}

function countDocumentLoads(page: Page) {
  const loads = { count: 0 };
  page.on("load", () => {
    loads.count += 1;
  });
  return loads;
}

const errorScreen = (page: Page) =>
  page.getByRole("alert").filter({ hasText: "VEGA stopped on an error" });

async function goToCalendarInApp(page: Page) {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("g");
  await page.keyboard.press("c");
}

test("a stale chunk on a direct load reloads once and then renders the route", async ({ page }) => {
  await enterApp(page);
  const failures = await failCalendarChunk(page, { times: 1 });
  const loads = countDocumentLoads(page);
  await page.goto("/calendar");

  await expect(page.getByRole("button", { name: "Today" }).first()).toBeVisible({
    timeout: 15_000,
  });
  expect(failures.count).toBe(1);
  expect(loads.count).toBe(2);
  await expect(errorScreen(page)).toHaveCount(0);
});

test("a chunk that keeps failing on a direct load shows the error screen after one reload", async ({
  page,
}) => {
  const failures = await failCalendarChunk(page, { times: Number.POSITIVE_INFINITY });
  const loads = countDocumentLoads(page);
  await page.goto("/calendar");

  await expect(errorScreen(page)).toBeVisible({ timeout: 15_000 });
  await expect(errorScreen(page).getByRole("button", { name: "Reload" })).toBeVisible();
  await page.waitForTimeout(1_500);
  expect(loads.count).toBe(2);
  expect(failures.count).toBe(2);
});

test("a chunk that keeps failing on navigation shows the error screen after one reload", async ({
  page,
}) => {
  await enterApp(page);
  await failCalendarChunk(page, { times: Number.POSITIVE_INFINITY });
  const loads = countDocumentLoads(page);
  await goToCalendarInApp(page);

  await expect(errorScreen(page)).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("main")).toHaveCount(0);
  await page.waitForTimeout(1_500);
  expect(loads.count).toBe(1);
});

test("a lazy route still loads when its chunk is reachable", async ({ page }) => {
  await enterApp(page);
  const loads = countDocumentLoads(page);
  await goToCalendarInApp(page);

  await expect(page).toHaveURL(/\/calendar$/);
  await expect(page.getByRole("button", { name: "Today" }).first()).toBeVisible();
  await expect(errorScreen(page)).toHaveCount(0);
  expect(loads.count).toBe(0);
});
