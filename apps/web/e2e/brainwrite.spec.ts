import { expect, test } from "@playwright/test";
import { enterApp } from "./helpers/app";

const deck = "[data-brainwrite-scroll]";

test("the deck lives at /brainwrite and the retired feed route lands on it", async ({ page }) => {
  await enterApp(page);
  await page.goto("/scroll", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/brainwrite$/);
  await expect(page.getByRole("region", { name: "BrainWrite deck" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.locator("article").first()).toBeVisible();
});

test("a card's sheet opens on right-click and reaches the deck control", async ({ page }) => {
  await enterApp(page);
  await page.goto("/brainwrite", { waitUntil: "domcontentloaded" });
  await expect(page.locator(deck)).toBeVisible({ timeout: 15_000 });

  await page.locator("article").first().click({ button: "right" });
  const sheet = page.getByRole("dialog", { name: "Card actions" });
  await expect(sheet).toBeVisible();

  await sheet.getByRole("button", { name: "Customize feed" }).click();
  await expect(page.getByRole("heading", { name: "What you see" })).toBeVisible();

  await page.getByRole("button", { name: "Back to the feed" }).click();
  await expect(page.getByRole("heading", { name: "What you see" })).toBeHidden();
  await expect(page.locator(deck)).toBeVisible();
});

test("the deck pages with the keyboard and logs nothing", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await enterApp(page);
  await page.goto("/brainwrite", { waitUntil: "domcontentloaded" });
  const scroller = page.locator(deck);
  await expect(scroller).toBeVisible({ timeout: 15_000 });

  await scroller.focus();
  await page.keyboard.press("ArrowDown");
  await expect
    .poll(() => scroller.evaluate((node) => node.scrollTop), { timeout: 5_000 })
    .toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
