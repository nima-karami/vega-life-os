import { expect, type Page, test } from "@playwright/test";
import { enterApp, turnQuietModeOff } from "./helpers/app";

function at(iso: string, hour: number): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, hour, 0, 0, 0);
}

async function boot(page: Page, time: Date, path = "/today") {
  await turnQuietModeOff(page);
  await page.clock.install({ time });
  await enterApp(page);
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });
}

async function addTodayTask(page: Page, title: string) {
  const opener = page.getByRole("button", { name: "Add task" });
  if (await opener.isVisible()) await opener.click({ force: true });
  await page.getByRole("textbox", { name: "Task title" }).fill(title);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: new RegExp(`^${title}`) })).toBeVisible();
}

test("no habit surface shows streaks or percentages", async ({ page }) => {
  await boot(page, at("2026-12-30", 12), "/habits");
  const main = page.locator("main");
  await expect(main.getByText(/\d+ of last \d+/).first()).toBeVisible({ timeout: 15_000 });
  await expect(main).not.toContainText(/streak|% kept|follow-through|healing/i);
});

test("never miss twice: a lapsed daily habit shows the nudge until it is done", async ({
  page,
}) => {
  await boot(page, at("2026-12-30", 12), "/habits");
  await page.getByRole("button", { name: "Add habit" }).click();
  await page.getByRole("textbox", { name: "Habit name" }).fill("Stretch");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page).toHaveURL(/\/habits\/[^/]+$/);
  await page.getByText("Track how often I keep it").click();

  const nudge = page.getByText("Back to it today. Even a small version counts.");
  await page.goto("/today", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "Mark Stretch done" })).toBeVisible();
  await expect(nudge).toHaveCount(0);

  await page.clock.setFixedTime(at("2026-12-31", 12));
  await page.goto("/today", { waitUntil: "domcontentloaded" });
  const card = page.getByRole("button", { name: /^Stretch/ });
  await expect(card).toContainText("Back to it today. Even a small version counts.");

  await page.getByRole("button", { name: "Mark Stretch done" }).click();
  await expect(card).not.toContainText("Back to it today");
});

test("completing valued tasks toasts each value once a day", async ({ page }) => {
  await boot(page, at("2026-12-30", 12));
  await page.evaluate(() => {
    const votes: string[] = [];
    (window as unknown as { __votes: string[] }).__votes = votes;
    new MutationObserver((records) => {
      for (const record of records)
        for (const node of record.addedNodes) {
          const text = node.textContent ?? "";
          if (text.startsWith("A vote for ")) votes.push(text);
        }
    }).observe(document.body, { childList: true, subtree: true });
  });
  const pending = page.locator(
    "button[aria-label^='Mark '][aria-label$=' done']:not([aria-label$=' not done']):visible",
  );
  const total = await pending.count();
  expect(total).toBeGreaterThan(2);
  for (let i = 0; i < total; i++) await pending.first().click();
  const votes = await page.evaluate(() => (window as unknown as { __votes: string[] }).__votes);
  expect(votes.length).toBeGreaterThan(0);
  expect(votes.length).toBeLessThan(total);
  const names = votes.map((v) =>
    v
      .replace(/^A vote for /, "")
      .split(/[.:]/)[0]
      .trim(),
  );
  expect(new Set(names).size).toBe(names.length);
});

test("task editor shows the value's why", async ({ page }) => {
  await boot(page, at("2026-12-30", 12));
  await page.getByRole("button", { name: /^Tidy 15 min/ }).click();
  const dialog = page.getByRole("dialog", { name: "Edit task" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("In service of Self-care")).toBeVisible();
});

test("close-out: carry one, let one go, reflect", async ({ page }) => {
  await boot(page, at("2026-12-30", 19));
  await addTodayTask(page, "Call bank");
  await addTodayTask(page, "Tidy desk");

  const evening = page.getByRole("region", { name: "This evening" });
  await evening.getByRole("button", { name: "Close the day" }).click();
  const dialog = page.getByRole("dialog", { name: "Close the day" });
  await expect(dialog.getByText("1 of 3")).toBeVisible();
  await dialog.getByRole("button", { name: "Next" }).click();
  await expect(dialog.getByRole("heading", { name: "Still open" })).toBeVisible();
  await dialog
    .getByRole("group", { name: "Call bank: carry or let go" })
    .getByRole("button", { name: "Tomorrow" })
    .click();
  await dialog
    .getByRole("group", { name: "Tidy desk: carry or let go" })
    .getByRole("button", { name: "Let it go" })
    .click();
  await dialog.getByRole("button", { name: "Next" }).click();
  await dialog.getByRole("radio").nth(2).click();
  await dialog.getByRole("button", { name: "Save reflection" }).click();
  await expect(page.getByText("Day closed.").first()).toBeVisible();
  await expect(dialog).toBeHidden();
  await expect(evening).toBeHidden();
  await expect(page.getByRole("button", { name: /^Call bank/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Tidy desk/ })).toContainText("Skipped");

  await page.goto("/today?date=2026-12-31", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: /^Call bank/ })).toBeVisible();
});

test("closing the close-out dialog writes nothing", async ({ page }) => {
  await boot(page, at("2026-12-30", 19));
  await addTodayTask(page, "Call bank");
  const evening = page.getByRole("region", { name: "This evening" });
  await evening.getByRole("button", { name: "Close the day" }).click();
  const dialog = page.getByRole("dialog", { name: "Close the day" });
  await dialog.getByRole("button", { name: "Next" }).click();
  await dialog
    .getByRole("group", { name: "Call bank: carry or let go" })
    .getByRole("button", { name: "Tomorrow" })
    .click();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: /^Call bank/ })).toBeVisible();
  await expect(evening).toBeVisible();
});

test("close-out with no open tasks is two steps", async ({ page }) => {
  await boot(page, at("2026-12-30", 19));
  const evening = page.getByRole("region", { name: "This evening" });
  await evening.getByRole("button", { name: "Close the day" }).click();
  const dialog = page.getByRole("dialog", { name: "Close the day" });
  await dialog.getByRole("button", { name: "Next" }).click();
  const letGo = dialog.getByRole("button", { name: "Let it go" });
  for (let i = 0, n = await letGo.count(); i < n; i++) await letGo.nth(i).click();
  await dialog.getByRole("button", { name: "Next" }).click();
  await dialog.getByRole("button", { name: "Save reflection" }).click();
  await expect(dialog).toBeHidden();

  await expect(evening).toBeHidden();
});

test("an empty close-out save closes silently and hides the evening card", async ({ page }) => {
  await boot(page, at("2026-12-30", 19));
  const evening = page.getByRole("region", { name: "This evening" });
  await evening.getByRole("button", { name: "Close the day" }).click();
  const dialog = page.getByRole("dialog", { name: "Close the day" });
  const save = dialog.getByRole("button", { name: "Save reflection" });
  while (!(await save.isVisible())) await dialog.getByRole("button", { name: "Next" }).click();
  await save.click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Day closed.")).toHaveCount(0);
  await expect(evening).toBeHidden();
});

test("weekly review leads with the done list and stores check-ins", async ({ page }) => {
  await boot(page, at("2026-12-30", 12), "/analytics");
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await expect(page.getByText("Here's what you did this week.")).toBeVisible();
  const body = page.locator("main");
  await expect(body).not.toContainText(/Slipped|Clean week|%/);

  const first = page.getByRole("button", { name: "Mostly" }).first();
  await first.click();
  await expect(first).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /Save reflection/ }).click();
  await expect(page.getByText("Reflection saved")).toBeVisible();

  await page.getByRole("button", { name: "Previous week" }).click();
  await page.getByRole("button", { name: "This week" }).click();
  const again = page.getByRole("button", { name: "Mostly" }).first();
  await expect(again).toHaveAttribute("aria-pressed", "true");
  await again.click();
  await expect(again).toHaveAttribute("aria-pressed", "false");
  await expect(body).not.toContainText("%");
});
