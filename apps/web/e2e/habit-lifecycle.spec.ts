import { expect, type Page, test } from "@playwright/test";
import { turnQuietModeOff } from "./helpers/app";

type Stamps = { pausedAt: string | null; resumedAt: string | null };

async function readStamps(page: Page, name: string): Promise<Stamps | null> {
  return page.evaluate(
    (habitName) =>
      new Promise<Stamps | null>((resolve, reject) => {
        const req = indexedDB.open("vega-life-os");
        req.onsuccess = () => {
          const all = req.result.transaction("habits").objectStore("habits").getAll();
          all.onsuccess = () => {
            const row = all.result.find((h: { name: string }) => h.name === habitName);
            resolve(
              row ? { pausedAt: row.pausedAt ?? null, resumedAt: row.resumedAt ?? null } : null,
            );
          };
          all.onerror = () => reject(all.error);
        };
        req.onerror = () => reject(req.error);
      }),
    name,
  );
}

/**
 * Habit lifecycle (Active / Paused / Archived). Proves the state control is reachable
 * from the habit's own page and that pausing moves the habit into its own section
 * without deleting it.
 */

test.beforeEach(async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const explore = page.getByRole("button", { name: /explore with sample data/i });
  const main = page.locator("main");
  await expect(explore.or(main)).toBeVisible({ timeout: 20_000 });
  if (await explore.isVisible().catch(() => false)) {
    await explore.click();
    await expect(main).toBeVisible({ timeout: 15_000 });
  }
  await page.goto("/habits", { waitUntil: "domcontentloaded" });
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

test("pausing is neutral: the paused days are neither kept nor due", async ({ page }) => {
  await turnQuietModeOff(page);
  const dayMs = 86_400_000;
  const noon = new Date();
  noon.setHours(12, 0, 0, 0);
  await page.clock.install({ time: noon });

  await page.getByRole("button", { name: "Add habit" }).click();
  await page.getByRole("textbox", { name: "Habit name" }).fill("Stretch");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page).toHaveURL(/\/habits\/[^/]+$/);
  await page.getByText("Track how often I keep it").click();
  const habitUrl = page.url();

  const markDone = async () => {
    await page.goto("/today", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Mark Stretch done" }).click();
    await expect(page.getByRole("button", { name: "Mark Stretch not done" })).toBeVisible();
  };
  const reloadAt = async (ms: number) => {
    await page.clock.setFixedTime(ms);
    await page.goto("/today", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: "Today", exact: true })).toBeVisible({
      timeout: 15_000,
    });
  };

  await markDone();
  await reloadAt(noon.getTime() + dayMs);
  await markDone();

  await page.goto(habitUrl, { waitUntil: "domcontentloaded" });
  const paused = page.getByRole("button", { name: "Paused", exact: true });
  await paused.click();
  await expect(paused).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => (await readStamps(page, "Stretch"))?.pausedAt).not.toBeNull();

  await reloadAt(noon.getTime() + 4 * dayMs);
  await page.goto(habitUrl, { waitUntil: "domcontentloaded" });
  const active = page.getByRole("button", { name: "Active", exact: true });
  await active.click();
  await expect(active).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(async () => {
      const stamps = await readStamps(page, "Stretch");
      return stamps?.pausedAt === null && stamps.resumedAt !== null;
    })
    .toBe(true);
  await markDone();

  await page.goto("/habits", { waitUntil: "domcontentloaded" });
  const card = page.getByRole("link", { name: "Stretch", exact: true });
  await expect(page.locator("li", { has: card })).toContainText("3 of last 3");
});
