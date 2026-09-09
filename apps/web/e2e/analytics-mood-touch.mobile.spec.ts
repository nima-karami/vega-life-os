import { expect, type Page, test } from "@playwright/test";
import { enterApp } from "./helpers/app";
import { describedAs, dotCentre, isoDaysAgo, openMoodChart } from "./helpers/mood";
import { tap } from "./helpers/touch";

/**
 * Phone touch details on the analytics mood chart, the habit day picker and the card
 * gutters (spec docs/specs/2026-09-04-analytics-habit-touch.md). Three *consecutive*
 * days are seeded on purpose: at that pitch the 24px hit columns overlap, so an interior
 * point's own dot sits under its right-hand neighbour's column. Sparser fixtures leave
 * every column unoccluded, where element-based and x-based resolution agree and neither
 * the two-tap rule nor nearest-centre resolution is actually under test.
 */

const SEEDED_DAYS_AGO = [0, 1, 2];
// A touchscreen tablet or laptop: past sm, still nothing but fingers.
const WIDE = { width: 900, height: 900 };

async function enterMoodChart(page: Page) {
  await enterApp(page);
  await openMoodChart(page, SEEDED_DAYS_AGO);
}

const moodPanel = (page: Page) =>
  page
    .locator("[data-iso]")
    .first()
    .locator('xpath=ancestor::*[contains(@class,"rounded-[16px]")][1]');

test("a first tap on an occluded mood point names that day and a second opens its journal", async ({
  page,
}) => {
  await enterMoodChart(page);
  const interior = isoDaysAgo(1);
  const point = await dotCentre(page, interior);

  await tap(page, point);
  const tooltip = page.getByTestId("mood-tooltip");
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toHaveText(await describedAs(page, interior));
  await expect(page).not.toHaveURL(/\/journal\//);

  await tap(page, point);
  await expect(page).toHaveURL(new RegExp(`/journal/${interior}$`));
});

test("a tap on a mood point past sm still names the day before opening its journal", async ({
  page,
}) => {
  await page.setViewportSize(WIDE);
  await enterMoodChart(page);
  const interior = isoDaysAgo(1);
  const point = await dotCentre(page, interior);

  await expect(page.getByText(/tap again to open its journal/)).toBeVisible();

  await tap(page, point);
  await expect(page.getByTestId("mood-tooltip")).toHaveText(await describedAs(page, interior));
  await expect(page).toHaveURL(/\/analytics$/);

  await tap(page, point);
  await expect(page).toHaveURL(new RegExp(`/journal/${interior}$`));
});

test("a tap between two mood points selects the nearer one", async ({ page }) => {
  await enterMoodChart(page);
  const today = isoDaysAgo(0);
  const older = isoDaysAgo(1);
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
  await enterMoodChart(page);
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
  await enterMoodChart(page);
  await expect(moodPanel(page)).toHaveCSS("padding-left", "16px");

  await page.goto("/settings", { waitUntil: "domcontentloaded" });
  const header = page
    .getByRole("heading", { name: "Appearance" })
    .locator('xpath=ancestor::*[contains(@class,"pb-0")][1]');
  await expect(header).toHaveCSS("padding-left", "16px");
});
