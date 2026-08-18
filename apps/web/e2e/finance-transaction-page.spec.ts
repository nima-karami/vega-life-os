import { expect, type Page, test } from "@playwright/test";
import { enterApp } from "./helpers/app";

/**
 * The two routed transaction pages: a new row is written by one button and nothing before it, and
 * an existing row saves itself field by field. The sandbox seeds these ids, so each test names one.
 */

const PARTNER_ROW = "ftxn_market_partner";
const SPREAD_ROW = "ftxn_licence";
const SETTLED_ROW = "ftxn_rent";

async function openPage(page: Page, path: string) {
  await enterApp(page);
  await page.goto(path, { waitUntil: "networkidle" });
  await expect(page.getByRole("link", { name: "Transactions" })).toBeVisible({ timeout: 15_000 });
}

// React Aria hides the real switch behind its styled control, so the click lands on the label.
const toggleSwitch = (page: Page, name: string) =>
  page.getByRole("switch", { name }).click({ force: true });

test("nothing is written until the one accent button is pressed", async ({ page }) => {
  await openPage(page, "/finance/transactions/new");

  const add = page.getByRole("button", { name: "Add transaction" });
  await expect(add).toBeDisabled();

  await page.getByRole("textbox", { name: "Transaction title" }).fill("Desk lamp for the study");
  await expect(add).toBeDisabled();
  await page.getByRole("textbox", { name: "Amount" }).fill("129.99");
  await expect(add).toBeEnabled();

  await add.click();
  await expect(page).toHaveURL(/\/finance\/transactions$/);
  await expect(page.getByRole("link", { name: "Desk lamp for the study" })).toBeVisible();
});

test("the share sentence derives both halves, and they sum to the charge", async ({ page }) => {
  await openPage(page, `/finance/transactions/${PARTNER_ROW}`);

  // The seed dates this row relative to today, so the month it settles in is not a fixed string.
  await expect(
    page.getByText(/^You bear \$56\.00 · \$56\.00 goes to your partner at the \w+ settle-up\.$/),
  ).toBeVisible();
});

test("the spread preview states the monthly figure and the remainder", async ({ page }) => {
  await openPage(page, `/finance/transactions/${SPREAD_ROW}`);

  await expect(page.getByRole("button", { name: "Spread over months…" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByText(/\$30\.00\/mo across 12 months/)).toBeVisible();
  await expect(page.getByText(/Cash still shows the full charge on its own date/)).toBeVisible();
});

test("a field saves itself, and the raw bank description is left alone", async ({ page }) => {
  await openPage(page, `/finance/transactions/${SPREAD_ROW}`);

  await expect(page.getByText(/From import/)).toBeVisible();
  await expect(page.getByText("demo-card.csv · row 1")).toBeVisible();

  await page.getByRole("button", { name: "Category" }).click();
  await page.getByRole("menuitem", { name: "Dining out", exact: true }).click();
  await page.getByRole("textbox", { name: "Note" }).fill("moved for the year");
  await expect(page.getByText("Saved just now")).toBeVisible({ timeout: 10_000 });

  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("button", { name: "Category" })).toHaveText("Dining out");
  await expect(page.getByRole("textbox", { name: "Note" })).toHaveValue("moved for the year");
  // The row still cites the statement line it came from — description is never rewritten.
  await expect(page.getByText("demo-card.csv · row 1")).toBeVisible();
});

test("turning a row shared offers the even split and the sentence follows", async ({ page }) => {
  await openPage(page, `/finance/transactions/${SPREAD_ROW}`);

  await expect(page.getByText(/^Not shared/)).toBeVisible();
  await toggleSwitch(page, "Shared with your partner");

  await expect(page.getByRole("textbox", { name: "My share" })).toHaveValue("50");
  await expect(page.getByText(/^You bear \$180\.00 · \$180\.00 comes back/)).toBeVisible();
});

test("a settled month still edits, and the strip says the edit amends it", async ({ page }) => {
  await openPage(page, `/finance/transactions/${SETTLED_ROW}`);

  await expect(
    page.getByText(/part of the settled \w+ settle-up — an edit here amends that month/),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Amount" })).toBeEditable();
});

test("archive is undoable, and puts the row back exactly as it stood", async ({ page }) => {
  await openPage(page, `/finance/transactions/${PARTNER_ROW}`);

  await page.getByRole("button", { name: "Archive" }).click();
  await expect(page.getByText("Groceries (her run) is archived")).toBeVisible();

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("textbox", { name: "Transaction title" })).toHaveValue(
    "Groceries (her run)",
  );
  await expect(page.getByRole("textbox", { name: "Amount" })).toHaveValue("112.00");
});
