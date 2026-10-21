import { expect, type Page } from "@playwright/test";
import { turnQuietModeOff } from "./app";
import { readStoredRows } from "./stored-rows";

/** Mood-chart fixtures. The sandbox seeds no journal rows, so every point is logged here. */

/** Derived from today so a month or year boundary can never strand the fixture. */
export function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function logMood(page: Page, iso: string) {
  await page.goto(`/journal/${iso}`, { waitUntil: "domcontentloaded" });
  const pip = page.getByRole("radio", { name: /^Mood 4 of 5/ });
  await expect(pip).toBeVisible({ timeout: 15_000 });
  await pip.click();
  await expect
    .poll(async () => {
      const entries = await readStoredRows<{ date: string; mood: number | null }>(page, "journal");
      return entries.find((entry) => entry.date === iso)?.mood;
    })
    .toBe(4);
}

export async function openMoodChart(page: Page, daysAgo: number[]) {
  await turnQuietModeOff(page);
  for (const days of daysAgo) await logMood(page, isoDaysAgo(days));
  await page.goto("/analytics", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-iso]").first()).toBeVisible({ timeout: 15_000 });
}

/** The tooltip repeats the point's accessible name, minus its destination clause. */
export async function describedAs(page: Page, iso: string): Promise<string> {
  const name = await page.locator(`[data-iso="${iso}"]`).getAttribute("aria-label");
  if (name == null) throw new Error(`the ${iso} point has no accessible name`);
  return name.replace(". Open journal.", "");
}

export async function dotCentre(page: Page, iso: string): Promise<{ x: number; y: number }> {
  const box = await page.locator(`[data-iso="${iso}"] span`).boundingBox();
  if (!box) throw new Error(`the ${iso} dot has no bounding box`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
