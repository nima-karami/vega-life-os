import { expect, type Page, test } from "@playwright/test";
import { enterApp } from "./helpers/app";

/**
 * A long ledger: search and filters narrow its rows, a selection is worked in
 * one action, and a settled month's rows say why they can't be touched.
 */

async function openLedger(page: Page) {
  await enterApp(page);
  await page.goto("/finance/transactions", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Transactions", exact: true })).toBeVisible({
    timeout: 15_000,
  });
}

const searchBox = (page: Page) => page.getByRole("searchbox", { name: "Search transactions" });
const anyRow = (page: Page) => page.getByRole("button", { name: /^Details for / });

// React Aria keeps the real checkbox visually hidden behind its styled control, so the hit-target
// check lands on the wrapping label. Forcing the click is how this codebase drives one.
const check = (page: Page, name: string) =>
  page.getByRole("checkbox", { name }).click({ force: true });

// A house Select trigger carries aria-labelledby alongside our aria-label, and labelledby wins: its
// accessible name is "<current value> <ariaLabel>", so a name anchored on the label never matches.
// Scoping to the row and taking the trigger sidesteps the naming entirely.
const rowCategory = (page: Page, description: string) =>
  page.locator("ul li", { hasText: description }).locator("[aria-haspopup='listbox']");

test("search and the review filter narrow the ledger", async ({ page }) => {
  await openLedger(page);
  const rowCount = await anyRow(page).count();
  expect(rowCount).toBeGreaterThan(2);

  await searchBox(page).fill("toolworks");
  await expect(anyRow(page)).toHaveCount(1);
  await expect(page.getByRole("button", { name: /^Details for TOOLWORKS/ })).toBeVisible();

  await searchBox(page).fill("");
  await expect(anyRow(page)).toHaveCount(rowCount);

  // The unknown-merchant row has no category, so it is unreviewed; the salary row is filed.
  // The internal transfers are exempt — a transfer never earns a category.
  await page.getByRole("button", { name: "Needs review", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Details for SQ \*8231/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Details for PAYROLL DEPOSIT/ })).toHaveCount(0);
  await expect(anyRow(page)).not.toHaveCount(rowCount);

  await page.getByRole("button", { name: "Reviewed", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Details for PAYROLL DEPOSIT/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Details for SQ \*8231/ })).toHaveCount(0);
});

test("a bulk category change lands on every selected row", async ({ page }) => {
  await openLedger(page);

  // Search now reads a row's title alongside its description, so the transfer titled
  // "Card payment" joins the two rows whose description carries the word.
  await searchBox(page).fill("pay");
  await expect(anyRow(page)).toHaveCount(3);

  await check(page, "Select all transactions");
  await expect(page.getByText("3 selected")).toBeVisible();

  await page.getByRole("button").filter({ hasText: "Choose…" }).first().click();
  await page.getByRole("option", { name: "Dining out", exact: true }).click();

  await expect(rowCategory(page, "PAYROLL DEPOSIT")).toHaveText("Dining out");
  await expect(rowCategory(page, "PAYMENT RECEIVED")).toHaveText("Dining out");
  await expect(rowCategory(page, "TRANSFER TO REWARDS CARD")).toHaveText("Dining out");
});

test("a row's own category picker files it in one click", async ({ page }) => {
  await openLedger(page);
  await searchBox(page).fill("SQ *8231");
  await expect(anyRow(page)).toHaveCount(1);

  await rowCategory(page, "SQ *8231").click();
  await page.getByRole("option", { name: "Groceries", exact: true }).click();
  await expect(rowCategory(page, "SQ *8231")).toHaveText("Groceries");

  // `no-category` derives from the row, so filing it empties the queue with no flag bookkeeping.
  await searchBox(page).fill("");
  await page.getByRole("button", { name: "Needs review", exact: true }).click();
  await expect(anyRow(page)).toHaveCount(0);
});

test("shift-click selects the range between two rows", async ({ page }) => {
  await openLedger(page);

  const boxes = page.getByRole("checkbox", { name: /^Select / });
  await boxes.nth(1).click({ force: true });
  await page.keyboard.down("Shift");
  await boxes.nth(4).click({ force: true });
  await page.keyboard.up("Shift");

  await expect(page.getByText("4 selected")).toBeVisible();
});

test("a row in a settled month is read-only and says why", async ({ page }) => {
  await openLedger(page);

  await searchBox(page).fill("property");
  await expect(anyRow(page)).toHaveCount(1);

  await expect(page.getByRole("img", { name: /is settled/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Category for PROPERTY MGMT/ })).toBeDisabled();
  await expect(
    page.getByRole("button", { name: /^Household split for PROPERTY MGMT/ }),
  ).toBeDisabled();

  await page.getByRole("button", { name: /^Details for PROPERTY MGMT/ }).click();
  await expect(page.getByText(/is settled, so its figure is frozen/).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Amend the month" })).toBeVisible();
  await expect(
    page.getByRole("spinbutton", { name: /^Your share percent for PROPERTY MGMT/ }),
  ).toBeDisabled();
});
