import { expect, test } from "@playwright/test";
import { openDeck } from "./helpers/deck";

test("the manager lives at /cards and the old path redirects", async ({ page }) => {
  await openDeck(page);
  await expect(page.getByRole("checkbox", { name: "Select every card in view" })).toBeVisible();

  await page.goto("/scroll/manage", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/cards$/);
  await expect(page.getByRole("heading", { name: "Cards", level: 1 })).toBeVisible();
});
