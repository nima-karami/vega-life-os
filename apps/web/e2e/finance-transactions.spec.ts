import { expect, type Page, test } from "@playwright/test";

/**
 * A long ledger: search and filters narrow its rows, a selection is worked in
 * one action, and a settled month's rows say why they can't be touched.
 */

async function enterApp(page: Page) {
  await page.goto("/", { waitUntil: "networkidle" });
  const explore = page.getByRole("button", { name: /explore with sample data/i });
  const main = page.locator("main");
  await expect(explore.or(main)).toBeVisible({ timeout: 20_000 });
  if (await explore.isVisible().catch(() => false)) {
    await explore.click();
    await expect(main).toBeVisible({ timeout: 15_000 });
  }

  // The morning gratitude gate hard-redirects every route but /today and /journal/*.
  const gate = page.getByRole("button", { name: "Continue to today" });
  if (await gate.isVisible().catch(() => false)) {
    await page.getByRole("textbox", { name: "Grateful for, item 1" }).fill("e2e gratitude");
    await gate.click();
    await expect(gate).toBeHidden();
  }
}

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

  await searchBox(page).fill("pay");
  await expect(anyRow(page)).toHaveCount(2);

  await check(page, "Select all transactions");
  await expect(page.getByText("2 selected")).toBeVisible();

  await page.getByRole("button").filter({ hasText: "Choose…" }).first().click();
  await page.getByRole("option", { name: "Dining out", exact: true }).click();

  await expect(page.getByRole("button", { name: /^Category for PAYROLL DEPOSIT/ })).toHaveText(
    "Dining out",
  );
  await expect(page.getByRole("button", { name: /^Category for PAYMENT RECEIVED/ })).toHaveText(
    "Dining out",
  );
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
