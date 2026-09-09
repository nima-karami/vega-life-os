import { expect, type Page, test } from "@playwright/test";
import { enterApp } from "./helpers/app";
import { tap } from "./helpers/touch";

/**
 * Phone touch details on the analytics mood chart, the habit day picker and the card
 * gutters (spec docs/specs/2026-09-04-analytics-habit-touch.md). The sandbox seeds no
 * journal rows, so every mood point here is logged by the test.
 */

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function logMood(page: Page, iso: string) {
  await page.goto(`/journal/${iso}`, { waitUntil: "domcontentloaded" });
  const pip = page.getByRole("radio", { name: /^Mood 4 of 5/ });
  await expect(pip).toBeVisible({ timeout: 15_000 });
  await pip.click();
}

async function openMoodChart(page: Page) {
  await enterApp(page);
  await logMood(page, isoDaysAgo(0));
  await logMood(page, isoDaysAgo(2));
  await page.goto("/analytics", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-iso]").first()).toBeVisible({ timeout: 15_000 });
}

/** The tooltip repeats the point's accessible name, minus its destination clause. */
async function describedAs(page: Page, iso: string): Promise<string> {
  const name = await page.locator(`[data-iso="${iso}"]`).getAttribute("aria-label");
  if (name == null) throw new Error(`the ${iso} point has no accessible name`);
  return name.replace(". Open journal.", "");
}

async function dotCentre(page: Page, iso: string) {
  const box = await page.locator(`[data-iso="${iso}"] span`).boundingBox();
  if (!box) throw new Error(`the ${iso} dot has no bounding box`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

const moodPanel = (page: Page) =>
  page
    .locator("[data-iso]")
    .first()
    .locator('xpath=ancestor::*[contains(@class,"rounded-[16px]")][1]');

test("a first tap on a mood point names the day and a second opens its journal", async ({
  page,
}) => {
  await openMoodChart(page);
  const today = isoDaysAgo(0);
  const point = await dotCentre(page, today);

  await tap(page, point);
  const tooltip = page.getByTestId("mood-tooltip");
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toHaveText(await describedAs(page, today));
  await expect(page).not.toHaveURL(/\/journal\//);

  await tap(page, point);
  await expect(page).toHaveURL(new RegExp(`/journal/${today}$`));
});

test("a tap between two mood points selects the nearer one", async ({ page }) => {
  await openMoodChart(page);
  const today = isoDaysAgo(0);
  const older = isoDaysAgo(2);
  const recent = await dotCentre(page, today);
  const earlier = await dotCentre(page, older);
  const midX = (recent.x + earlier.x) / 2;
  const towardToday = recent.x > earlier.x ? 3 : -3;

  await tap(page, { x: midX + towardToday, y: recent.y });
  await expect(page.getByTestId("mood-tooltip")).toHaveText(await describedAs(page, today));
  await expect(page).toHaveURL(/\/analytics$/);

  await tap(page, { x: midX - towardToday, y: earlier.y });
  await expect(page.getByTestId("mood-tooltip")).toHaveText(await describedAs(page, older));
  await expect(page).toHaveURL(/\/analytics$/);
});

test("a tap off the plot dismisses the mood tooltip and navigates nowhere", async ({ page }) => {
  await openMoodChart(page);
  await tap(page, await dotCentre(page, isoDaysAgo(0)));
  await expect(page.getByTestId("mood-tooltip")).toBeVisible();

  const head = page.getByText("Mood", { exact: true }).first();
  const box = await head.boundingBox();
  if (!box) throw new Error("the mood section head has no bounding box");
  await tap(page, { x: box.x + box.width / 2, y: box.y + box.height / 2 });

  await expect(page.getByTestId("mood-tooltip")).toHaveCount(0);
  await expect(page).toHaveURL(/\/analytics$/);
});

test("a habit's day picker keeps its buttons and drops the mouse-only hint", async ({ page }) => {
  await enterApp(page);
  await page.goto("/habits", { waitUntil: "domcontentloaded" });
  await page
    .locator('main a[href^="/habits/"]')
    .filter({ hasText: "Morning walk" })
    .first()
    .click();

  await expect(page.getByRole("button", { name: "Monday" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/Shift-click/)).toHaveCount(0);
});

test("the mood panel and a settings card sit on a 16px phone gutter", async ({ page }) => {
  await openMoodChart(page);
  await expect(moodPanel(page)).toHaveCSS("padding-left", "16px");

  await page.goto("/settings", { waitUntil: "domcontentloaded" });
  const header = page
    .getByRole("heading", { name: "Appearance" })
    .locator('xpath=ancestor::*[contains(@class,"pb-0")][1]');
  await expect(header).toHaveCSS("padding-left", "16px");
});
