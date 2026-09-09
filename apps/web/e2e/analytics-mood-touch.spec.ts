import { expect, type Page, test } from "@playwright/test";
import { enterApp } from "./helpers/app";

/**
 * The desktop half of the mood-chart touch work: a mouse keeps hover plus one-click
 * navigation, and the wider gutters are unchanged (spec
 * docs/specs/2026-09-04-analytics-habit-touch.md).
 */

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function openMoodChart(page: Page) {
  await enterApp(page);
  await page.goto(`/journal/${isoDaysAgo(0)}`, { waitUntil: "domcontentloaded" });
  const pip = page.getByRole("radio", { name: /^Mood 4 of 5/ });
  await expect(pip).toBeVisible({ timeout: 15_000 });
  await pip.click();
  await page.goto("/analytics", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-iso]").first()).toBeVisible({ timeout: 15_000 });
}

test("a mouse hover names the day and one click opens its journal", async ({ page }) => {
  await openMoodChart(page);
  const today = isoDaysAgo(0);
  const point = page.locator(`[data-iso="${today}"]`);

  await point.hover();
  await expect(page.getByTestId("mood-tooltip")).toBeVisible();

  await point.click();
  await expect(page).toHaveURL(new RegExp(`/journal/${today}$`));
});

test("the mood panel and a settings card keep their 24px desktop gutter", async ({ page }) => {
  await openMoodChart(page);
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
