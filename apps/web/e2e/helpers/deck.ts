import { expect, type Page } from "@playwright/test";
import { enterApp } from "./app";

/** Boot the signed-out sandbox and land on the deck. */
export async function openDeck(page: Page) {
  await enterApp(page);
  await page.goto("/cards", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Cards", level: 1 })).toBeVisible({
    timeout: 15_000,
  });
}
