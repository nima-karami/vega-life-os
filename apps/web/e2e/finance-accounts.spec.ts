import { expect, type Page, test } from "@playwright/test";
import { enterApp } from "./helpers/app";
import { clearFinanceStores } from "./helpers/finance";

/**
 * Making an account, and every dead end that used to name one without offering it. The sandbox
 * seeds "Everyday chequing" and "Rewards card", both open, so the zero-account states are reached
 * by archiving them through the card — never by writing to storage.
 */

const SEEDED = ["Everyday chequing", "Rewards card"];

const card = (page: Page) => page.getByTestId("finance-accounts-card");

async function openImport(page: Page) {
  await page.goto("/finance/import", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Import", exact: true })).toBeVisible({
    timeout: 15_000,
  });
}

async function createAccount(page: Page, name: string, kind?: string) {
  await page.getByRole("textbox", { name: "Account name" }).fill(name);
  if (kind) await page.getByRole("button", { name: kind, exact: true }).click();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("textbox", { name: "Account name" })).toBeHidden();
}

async function createFromCard(page: Page, name: string, kind?: string) {
  await card(page).getByRole("button", { name: "New account" }).click();
  await createAccount(page, name, kind);
}

async function chooseRowAction(page: Page, name: string, item: string) {
  await card(page)
    .getByRole("button", { name: `Actions for ${name}` })
    .click();
  await page.getByRole("menuitem", { name: item }).click();
}

async function archiveAccount(page: Page, name: string) {
  await chooseRowAction(page, name, "Archive");
  await expect(page.getByText(`Archive ${name}?`)).toBeVisible();
  await page.getByRole("button", { name: "Archive", exact: true }).click();
  await expect(page.getByText(`Archive ${name}?`)).toBeHidden();
}

async function openAccountPicker(page: Page) {
  await page.getByRole("button", { name: "Account column" }).click();
}

test("an account is created from the sidebar and offered as an import target", async ({ page }) => {
  await enterApp(page);
  await openImport(page);

  await createFromCard(page, "E2E Savings", "Savings");

  await expect(card(page).getByText("E2E Savings")).toBeVisible();
  await expect(card(page).getByText("Savings", { exact: true })).toBeVisible();

  await openAccountPicker(page);
  await expect(page.getByRole("menuitem", { name: "E2E Savings" })).toBeVisible();
});

test("a colliding name takes the next slug, and a rename never moves it", async ({ page }) => {
  await enterApp(page);
  await openImport(page);

  await createFromCard(page, "E2E Savings", "Savings");
  await createFromCard(page, "E2E Savings", "Savings");

  await card(page).getByRole("button", { name: "Actions for E2E Savings" }).last().click();
  await page.getByRole("menuitem", { name: "Rename…" }).click();
  await expect(page.getByText("e2e-savings-2")).toBeVisible();

  await page.getByRole("textbox", { name: "Account name" }).fill("E2E Rainy Day");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("textbox", { name: "Account name" })).toBeHidden();

  await chooseRowAction(page, "E2E Rainy Day", "Rename…");
  await expect(page.getByText("e2e-savings-2")).toBeVisible();
  await expect(page.getByText("Used in duplicate keys — fixed")).toBeVisible();
});

test("the row menu moves an account to business and says so", async ({ page }) => {
  await enterApp(page);
  await openImport(page);

  await chooseRowAction(page, "Rewards card", "Mark as business");
  await expect(page.getByText("Rewards card is now a business account")).toBeVisible();
  await expect(card(page).getByText("Credit card · Business")).toBeVisible();
});

test("archiving both accounts closes the import and offers the way back", async ({ page }) => {
  await enterApp(page);
  await openImport(page);

  for (const name of SEEDED) await archiveAccount(page, name);

  await expect(card(page).getByText("Archived")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Add an account" })).toBeVisible();
  await expect(page.locator('input[type="file"]')).toBeDisabled();
  await expect(page.getByText("Add an account first.")).toBeVisible();

  await openAccountPicker(page);
  await expect(page.getByRole("menuitem", { name: "Everyday chequing" })).toHaveCount(0);
  await expect(page.getByRole("menuitem", { name: "New account…" })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.goto("/finance/transactions", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Filter by account" }).click();
  await expect(page.getByRole("menuitem", { name: "Everyday chequing (archived)" })).toBeVisible();
  await page.keyboard.press("Escape");

  await openImport(page);
  await chooseRowAction(page, "Everyday chequing", "Restore");
  await expect(page.getByText("Restored Everyday chequing")).toBeVisible();
  await expect(page.locator('input[type="file"]')).toBeEnabled();

  await openAccountPicker(page);
  await expect(page.getByRole("menuitem", { name: "Everyday chequing" })).toBeVisible();
});

test("a file chosen with no account is answered rather than swallowed", async ({ page }) => {
  await enterApp(page);
  await openImport(page);

  for (const name of SEEDED) await archiveAccount(page, name);

  await page.locator('input[type="file"]').setInputFiles(
    {
      name: "e2e-orphan.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("Date,Description,Amount\n2026-01-02,E2E SHOP,-1.00"),
    },
    { force: true },
  );

  await expect(page.getByText("Add an account before importing")).toBeVisible();
  await expect(page.getByText("Add an account first.")).toBeVisible();
});

test("New account… in the picker creates the account and selects it", async ({ page }) => {
  await enterApp(page);
  await openImport(page);

  await openAccountPicker(page);
  await page.getByRole("menuitem", { name: "New account…" }).click();
  await createAccount(page, "E2E Picker Card", "Credit card");

  await expect(page.getByRole("button", { name: "Account column" })).toContainText(
    "E2E Picker Card",
  );
});

test("the overview guides a book with nothing in it", async ({ page }) => {
  await enterApp(page);
  await page.goto("/finance", { waitUntil: "networkidle" });
  await clearFinanceStores(page, ["financeAccounts", "financeTransactions"]);
  await page.goto("/finance", { waitUntil: "networkidle" });

  await expect(page.getByText("Set up your first account")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Add an account" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add a transaction by hand" })).toBeVisible();

  await page.getByRole("button", { name: "Add an account" }).click();
  await createAccount(page, "E2E Chequing");

  await expect(page.getByText("Nothing imported yet")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add a transaction by hand" })).toBeVisible();
  // The overview's header carries its own "Import statements"; the guide's is the later one.
  await expect(page.getByRole("button", { name: "Import statements" }).last()).toBeVisible();
});

test("the ledger guides the same empty book", async ({ page }) => {
  await enterApp(page);
  await page.goto("/finance/transactions", { waitUntil: "networkidle" });
  await clearFinanceStores(page, ["financeAccounts", "financeTransactions"]);
  await page.goto("/finance/transactions", { waitUntil: "networkidle" });

  await expect(page.getByText("Set up your first account")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Add an account" })).toBeVisible();

  await page.getByRole("button", { name: "Add an account" }).click();
  await createAccount(page, "E2E Chequing");

  await expect(page.getByText("No transactions yet")).toBeVisible();
  await expect(page.getByRole("button", { name: "Import statements" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add a transaction by hand" })).toBeVisible();
});
