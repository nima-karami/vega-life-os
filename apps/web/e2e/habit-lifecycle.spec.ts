import { expect, test } from "@playwright/test";

/**
 * Habit lifecycle (Active / Paused / Archived). Proves the state control is reachable
 * from the editor (not just the card menu) and that pausing moves the habit into its
 * own section without deleting it.
 */

async function passGratitudeGate(page: import("@playwright/test").Page) {
  const gate = page.getByRole("button", { name: "Continue to today" });
  if (await gate.isVisible().catch(() => false)) {
    await page.getByRole("textbox", { name: "Grateful for, item 1" }).fill("e2e gratitude");
    await gate.click();
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const explore = page.getByRole("button", { name: /explore with sample data/i });
  const main = page.locator("main");
  await expect(explore.or(main)).toBeVisible({ timeout: 20_000 });
  if (await explore.isVisible().catch(() => false)) {
    await explore.click();
    await expect(main).toBeVisible({ timeout: 15_000 });
  }
  // The morning gratitude gate forces /today until passed — clear it before navigating,
  // or /habits redirects straight back to /today.
  await passGratitudeGate(page);

  await page.goto("/habits", { waitUntil: "domcontentloaded" });
  await passGratitudeGate(page);
  await expect(page.getByRole("heading", { name: "Habits", exact: true })).toBeVisible({
    timeout: 15_000,
  });
});

test("the editor exposes an Active/Paused/Archived status control", async ({ page }) => {
  await page
    .getByRole("button", { name: /^Edit / })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  const active = dialog.getByRole("button", { name: "Active" });
  const paused = dialog.getByRole("button", { name: "Paused" });
  await expect(active).toHaveAttribute("aria-pressed", "true");
  await expect(paused).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Archived" })).toBeVisible();
  // Delete stays available as the separate destructive action.
  await expect(dialog.getByRole("button", { name: "Delete" })).toBeVisible();

  await paused.click();
  await expect(paused).toHaveAttribute("aria-pressed", "true");
  await expect(dialog.getByText(/not generating new instances/i)).toBeVisible();
});

test("pausing moves a habit into the Paused section (not deleted)", async ({ page }) => {
  const firstEdit = page.getByRole("button", { name: /^Edit / }).first();
  const label = (await firstEdit.getAttribute("aria-label")) ?? "";
  const name = label.replace(/^Edit /, "").replace(/,.*$/, "");

  await firstEdit.click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Paused" }).click();
  await dialog.getByRole("button", { name: /^(Cancel|Close)$/ }).click();
  await expect(dialog).toHaveCount(0);

  // A Paused disclosure now exists; expand it and confirm the habit is there with a badge.
  const disclosure = page.getByRole("button", { name: /paused/i }).first();
  await disclosure.click();
  const pausedCard = page.getByRole("button", { name: new RegExp(`Edit ${name}, paused`) });
  await expect(pausedCard).toBeVisible();
});
