import { expect, type Page } from "@playwright/test";

/** Boot the signed-out sandbox; every route is reachable from here. */
export async function enterApp(page: Page) {
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

/** Write today's gratitude through the Today card, so today has a journal entry. */
export async function saveGratitude(page: Page) {
  const card = page.getByRole("region", { name: "Gratitude" });
  await card.getByRole("textbox", { name: "Grateful for, item 1" }).fill("e2e gratitude");
  await card.getByRole("button", { name: "Save" }).click();
  await expect(card).toBeHidden();
}
