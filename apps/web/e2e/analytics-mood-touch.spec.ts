import { expect, type Page, test } from "@playwright/test";
import { enterApp } from "./helpers/app";
import { describedAs, dotCentre, isoDaysAgo, openMoodChart } from "./helpers/mood";

/**
 * The desktop half of the mood-chart touch work: a mouse keeps hover plus one-click
 * navigation, and the wider gutters are unchanged (spec
 * docs/specs/2026-09-04-analytics-habit-touch.md). Under 640px a mouse meets the phone's
 * overlapping hit columns — a narrowed window or ≥250% zoom — so that width is covered
 * here too; neither existing project reaches it otherwise.
 */

async function enterMoodChart(page: Page, daysAgo: number[]) {
  await enterApp(page);
  await openMoodChart(page, daysAgo);
}

test("a mouse hover names the day and one click opens its journal", async ({ page }) => {
  await enterMoodChart(page, [0]);
  const today = isoDaysAgo(0);
  const point = page.locator(`[data-iso="${today}"]`);

  await point.hover();
  await expect(page.getByTestId("mood-tooltip")).toBeVisible();

  await point.click();
  await expect(page).toHaveURL(new RegExp(`/journal/${today}$`));
});

test("a mouse under 640px names and opens the day whose dot it is on", async ({ page }) => {
  await page.setViewportSize({ width: 420, height: 900 });
  await enterMoodChart(page, [0, 1, 2]);
  const interior = isoDaysAgo(1);
  const dot = await dotCentre(page, interior);

  await page.mouse.move(dot.x, dot.y);
  await expect(page.getByTestId("mood-tooltip")).toHaveText(await describedAs(page, interior));

  await page.mouse.click(dot.x, dot.y);
  await expect(page).toHaveURL(new RegExp(`/journal/${interior}$`));
});

test("the mood panel and a settings card keep their 24px desktop gutter", async ({ page }) => {
  await enterMoodChart(page, [0]);
  const panel = page
    .locator("[data-iso]")
    .first()
    .locator('xpath=ancestor::*[contains(@class,"rounded-[16px]")][1]');
  await expect(panel).toHaveCSS("padding-left", "24px");

  await page.goto("/settings", { waitUntil: "domcontentloaded" });
  const header = page
    .getByRole("heading", { name: "Appearance" })
    .locator('xpath=ancestor::*[contains(@class,"pb-0")][1]');
  await expect(header).toHaveCSS("padding-left", "24px");
});
