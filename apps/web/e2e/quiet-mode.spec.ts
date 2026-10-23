import { expect, type Page } from "@playwright/test";
import { test } from "./fixtures";
import { enterApp } from "./helpers/app";

async function openCommandBar(page: Page) {
  await page.getByTestId("omni-trigger").click();
  const dialog = page.getByRole("dialog", { name: "Command bar" });
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  return dialog;
}

async function expectScoresHidden(page: Page) {
  await page.goto("/habits", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("link", { name: "Read 1h before bed", exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.locator("main")).not.toContainText("of last");

  await page.goto("/values", { waitUntil: "domcontentloaded" });
  await expect(page.locator('main a[href^="/goals/"]').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("main")).not.toContainText(/\d+%|On pace|Slower than planned/);
}

test("quiet mode is on in a fresh sandbox: no counts, no pace, no Analytics", async ({ page }) => {
  await enterApp(page);
  await expectScoresHidden(page);

  const commandBar = await openCommandBar(page);
  await expect(commandBar.getByRole("option", { name: /^Weekly review/ })).toBeVisible();
  await expect(commandBar.getByRole("option", { name: /^Analytics/ })).toHaveCount(0);
  await expect(commandBar.getByRole("option", { name: /^Turn quiet mode off/ })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.goto("/analytics", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/today$/);

  await page.goto("/analytics?tab=review", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Here's what you did this week.")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("group", { name: "Analytics sections" })).toHaveCount(0);
});

test("turning quiet mode off in Settings brings the scores back and survives a reload", async ({
  page,
}) => {
  await enterApp(page);
  await page.goto("/settings", { waitUntil: "domcontentloaded" });
  const quietSwitch = page.getByRole("switch", { name: "Quiet mode" });
  await expect(quietSwitch).toBeChecked({ timeout: 15_000 });
  await expect(page.getByText("Hide scores, counts and Analytics.")).toBeVisible();
  await quietSwitch.click({ force: true });
  await expect(quietSwitch).not.toBeChecked();

  const commandBar = await openCommandBar(page);
  await commandBar.getByRole("option", { name: /^Habits/ }).click();
  await expect(page).toHaveURL(/\/habits$/);
  await expect(
    page
      .locator("main")
      .getByText(/\d+ of last \d+/)
      .first(),
  ).toBeVisible({
    timeout: 15_000,
  });

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(
    page
      .locator("main")
      .getByText(/\d+ of last \d+/)
      .first(),
  ).toBeVisible({
    timeout: 15_000,
  });
  await page.goto("/values", { waitUntil: "domcontentloaded" });
  await expect(
    page
      .locator("main")
      .getByText(/^\d+%$/)
      .first(),
  ).toBeVisible({ timeout: 15_000 });

  await page.goto("/analytics", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/analytics$/);
  await expect(page.getByRole("group", { name: "Analytics sections" })).toBeVisible({
    timeout: 15_000,
  });

  const again = await openCommandBar(page);
  await expect(again.getByRole("option", { name: /^Analytics/ })).toBeVisible();
  await again.getByRole("option", { name: /^Turn quiet mode on/ }).click();
  await expect(page).toHaveURL(/\/today$/);
  await expectScoresHidden(page);
});
