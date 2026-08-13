import { expect, type Page } from "@playwright/test";

/** Boot the signed-out sandbox, clear the gratitude gate, and land on the deck. */
export async function openDeck(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const explore = page.getByRole("button", { name: /explore with sample data/i });
  const main = page.locator("main");
  await expect(explore.or(main)).toBeVisible({ timeout: 20_000 });
  if (await explore.isVisible().catch(() => false)) {
    await explore.click();
    await expect(main).toBeVisible({ timeout: 15_000 });
  }
  const gate = page.getByRole("button", { name: "Continue to today" });
  if (await gate.isVisible().catch(() => false)) {
    await page.getByRole("textbox", { name: "Grateful for, item 1" }).fill("e2e gratitude");
    await gate.click();
    await expect(gate).toBeHidden();
  }
  await page.goto("/cards", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Cards", level: 1 })).toBeVisible({
    timeout: 15_000,
  });
}
