import { expect, type Page, test } from "@playwright/test";
import { format, startOfMonth, subMonths } from "date-fns";

/**
 * The finance dashboard against the synthetic sandbox seed. The seed anchors its settled month
 * to `startOfMonth(now - 2 months)`, so that month's figures are the same whatever day it is —
 * the current month's are not, and are only ever compared, never asserted exactly.
 */

const SETTLED_MONTH = startOfMonth(subMonths(new Date(), 2));
const SETTLED_LABEL = format(SETTLED_MONTH, "MMMM yyyy");
const UNBUDGETED_LABEL = format(subMonths(SETTLED_MONTH, 1), "MMMM yyyy");

async function bootSandbox(page: Page) {
  await page.goto("/", { waitUntil: "networkidle" });
  const explore = page.getByRole("button", { name: /explore with sample data/i });
  const main = page.locator("main");
  await expect(explore.or(main)).toBeVisible({ timeout: 20_000 });
  if (await explore.isVisible().catch(() => false)) {
    await explore.click();
    await expect(main).toBeVisible({ timeout: 15_000 });
  }
}

// The morning gratitude gate hard-redirects every route but /today and /journal/*.
async function passGratitudeGate(page: Page) {
  const gate = page.getByRole("button", { name: "Continue to today" });
  if (await gate.isVisible().catch(() => false)) {
    await page.getByRole("textbox", { name: "Grateful for, item 1" }).fill("e2e gratitude");
    await gate.click();
    await expect(gate).toBeHidden();
  }
}

async function openDashboard(page: Page) {
  await bootSandbox(page);
  await passGratitudeGate(page);
  await page.goto("/finance", { waitUntil: "networkidle" });
  await passGratitudeGate(page);
  if (!/\/finance$/.test(page.url())) await page.goto("/finance", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Finance", exact: true })).toBeVisible({
    timeout: 10_000,
  });
}

const cashStrip = (page: Page) => page.getByRole("region", { name: "Cash on your accounts" });
const budgetSection = (page: Page) => page.getByRole("region", { name: "Budget vs actual" });
const untrackedSection = (page: Page) => page.getByRole("region", { name: "Untracked categories" });

async function stepBack(page: Page, months: number) {
  for (let step = 0; step < months; step += 1) {
    await page.getByRole("button", { name: "Previous month" }).click();
  }
}

test("the dashboard renders budget vs actual against the seed", async ({ page }) => {
  await openDashboard(page);
  await stepBack(page, 2);
  await expect(page.getByText(SETTLED_LABEL, { exact: true })).toBeVisible();

  await expect(cashStrip(page)).toContainText("$2,142.50");
  await expect(
    budgetSection(page).getByRole("progressbar", {
      name: "Groceries: $71.25 borne of $500.00 budgeted",
    }),
  ).toBeVisible();
  await expect(
    budgetSection(page).getByRole("progressbar", {
      name: "Home & rent: $1,000.00 borne of $2,000.00 budgeted",
    }),
  ).toBeVisible();
  await expect(untrackedSection(page)).toBeHidden();
});

test("changing the month changes the figures", async ({ page }) => {
  await openDashboard(page);
  await expect(budgetSection(page)).toContainText("Month-end figures are an estimate");
  const thisMonthCash = await cashStrip(page).innerText();

  await stepBack(page, 2);
  await expect(page.getByText(SETTLED_LABEL, { exact: true })).toBeVisible();
  const settledCash = await cashStrip(page).innerText();
  expect(settledCash).not.toBe(thisMonthCash);
  expect(settledCash).toContain("$2,142.50");

  // A past month has no run rate left to project, so the estimate caveat goes with it.
  await expect(budgetSection(page)).not.toContainText("Month-end figures are an estimate");

  await page.getByRole("button", { name: "This month" }).click();
  await expect(page.getByRole("button", { name: "This month" })).toBeHidden();
  expect(await cashStrip(page).innerText()).toBe(thisMonthCash);
});

test("a category with no budget shows as untracked with a way to set one", async ({ page }) => {
  await openDashboard(page);
  await stepBack(page, 3);
  await expect(page.getByText(UNBUDGETED_LABEL, { exact: true })).toBeVisible();

  await expect(budgetSection(page)).toContainText("No category has a budget for this month yet");
  const untracked = untrackedSection(page);
  await expect(untracked).toBeVisible();
  await expect(untracked).toContainText("Groceries");
  await expect(untracked.getByRole("button", { name: "Set a budget for Groceries" })).toBeVisible();

  await untracked.getByRole("button", { name: "Set a budget for Groceries" }).click();
  await expect(page).toHaveURL(/\/finance\/categories\?category=/);
});
