import { expect, type Page } from "@playwright/test";
import { readStoredRows } from "./stored-rows";

/** Pre-skips the daily gratitude page on every day, which also silences the missed-gratitude
 *  nudge. Applies from the next navigation on. */
export async function skipGratitudePage(page: Page) {
  await page.addInitScript(() =>
    localStorage.setItem("vega.gratitudeNudgeAckedThrough", "9999-12-31"),
  );
}

/** Boot the signed-out sandbox past the gratitude page; every route is reachable from here.
 *  `keepGratitudePage` leaves the page up, for specs that answer it. */
export async function enterApp(page: Page, { keepGratitudePage = false } = {}) {
  if (!keepGratitudePage) await skipGratitudePage(page);
  // Not `networkidle`: the service worker keeps connections alive, so it never settles
  // under load — the explicit wait below is both stronger and deterministic.
  await page.goto("/");
  const explore = page.getByRole("button", { name: /explore with sample data/i });
  const main = page.locator("main");
  await expect(explore.or(main)).toBeVisible({ timeout: 20_000 });
  if (await explore.isVisible().catch(() => false)) {
    await explore.click();
    await expect(main).toBeVisible({ timeout: 15_000 });
  }
}

export const gratitudePage = (page: Page) =>
  page.getByRole("region", { name: "Morning gratitude" });

/** Answer today's gratitude page, so today has a journal entry. */
export async function saveGratitude(page: Page) {
  const prompt = gratitudePage(page);
  await prompt.getByRole("textbox", { name: "Grateful for, item 1" }).fill("e2e gratitude");
  await prompt.getByRole("button", { name: "Continue" }).click();
  await expect(prompt).toBeHidden();
  await expect
    .poll(async () => {
      const entries = await readStoredRows<{ gratitude: string[] }>(page, "journal");
      return entries.some((entry) => entry.gratitude.includes("e2e gratitude"));
    })
    .toBe(true);
}

/** Quiet mode is on by default; specs that assert on scores or Analytics turn it off first.
 *  Applies from the next navigation on. */
export async function turnQuietModeOff(page: Page) {
  await page.addInitScript(() => localStorage.setItem("vega.quietMode", "off"));
}

export const DAY_MS = 86_400_000;

/** Noon on the next Monday after the real today — derived, so no month is ever pinned. */
export function upcomingMondayNoon(): Date {
  const noon = new Date();
  noon.setHours(12, 0, 0, 0);
  const daysAhead = (8 - noon.getDay()) % 7 || 7;
  return new Date(noon.getTime() + daysAhead * DAY_MS);
}
