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

test("an excerpt shows its title and reveals the passage and its source on a tap", async ({
  page,
}) => {
  await enterApp(page);
  await page.goto("/brainwrite", { waitUntil: "domcontentloaded" });
  await expect(page.locator(deck)).toBeVisible({ timeout: 15_000 });

  // The deck seed is per-session, so narrow the feed to the type rather than hunt for a card.
  await page.locator("article").first().click({ button: "right" });
  await page.getByRole("button", { name: "Customize feed" }).click();
  await page.getByRole("button", { name: "Excerpt", exact: true }).click();
  await page.getByRole("button", { name: /^Show \d+ cards?$/ }).click();
  await expect(page.locator(deck)).toBeVisible();

  const card = page.getByRole("article", { name: /, showing the (front|reveal)$/ }).first();
  const stage = card.locator("[data-brainwrite-flip]");
  // The bounce hints are aria-hidden too, so narrow to the turning card's own sides.
  const hidden = card.locator('[class*="backface"][aria-hidden="true"]');
  await expect(stage).toHaveAttribute("data-brainwrite-flip", "face");
  // The passage and its page reference sit on the back, withheld until the tap.
  await expect(hidden).toContainText(/p\. \d+/);

  await card.click();
  await expect(stage).toHaveAttribute("data-brainwrite-flip", "reveal");
  await expect(card).toHaveAttribute("aria-label", /, showing the reveal$/);
  await expect(hidden).not.toContainText(/p\. \d+/);
});
