import { expect, test } from "@playwright/test";

/**
 * Habit lifecycle (Active / Paused / Archived). Proves the state control is reachable
 * from the habit's own page and that pausing moves the habit into its own section
 * without deleting it.
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

/** Opens the first habit's page and returns its name. */
async function openFirstHabit(page: import("@playwright/test").Page): Promise<string> {
  const card = page.locator('main a[href^="/habits/"]').first();
  const name = ((await card.textContent()) ?? "").trim();
  await card.click();
  await expect(page.getByRole("textbox", { name: "Habit name" })).toHaveValue(name);
  return name;
}

test("the habit page exposes an Active/Paused/Archived status control", async ({ page }) => {
  await openFirstHabit(page);

  const active = page.getByRole("button", { name: "Active", exact: true });
  const paused = page.getByRole("button", { name: "Paused", exact: true });
  await expect(active).toHaveAttribute("aria-pressed", "true");
  await expect(paused).toBeVisible();
  await expect(page.getByRole("button", { name: "Archived", exact: true })).toBeVisible();
  // Delete stays available as the separate destructive action.
  await expect(page.getByRole("button", { name: "Delete habit" })).toBeVisible();

  await paused.click();
  await expect(paused).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/not generating new instances/i)).toBeVisible();
});

test("pausing moves a habit into the Paused section (not deleted)", async ({ page }) => {
  const name = await openFirstHabit(page);

  await page.getByRole("button", { name: "Paused", exact: true }).click();
  // The habit page's trail now climbs to its value, so return to the index directly.
  await page.goto("/habits", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Habits", exact: true })).toBeVisible();

  // A Paused disclosure now exists; expand it and confirm the habit is there.
  await page
    .getByRole("button", { name: /paused/i })
    .first()
    .click();
  await expect(page.getByRole("link", { name, exact: true })).toBeVisible();
});
