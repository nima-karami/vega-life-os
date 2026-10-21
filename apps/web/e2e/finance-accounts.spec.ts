import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { format, setDate, subDays, subMonths } from "date-fns";
import { enterApp } from "./helpers/app";
import { clearFinanceStores } from "./helpers/finance";

/**
 * Making an account, and every dead end that used to name one without offering it. The sandbox
 * seeds "Everyday chequing" and "Rewards card", both open, so the zero-account states are reached
 * by archiving them through the card — never by writing to storage.
 */

const SEEDED = ["Everyday chequing", "Rewards card"];

/** Last month, never a fixed one: the seed settles the month two back and freezes its rows. */
const STATEMENT_ANCHOR = subMonths(new Date(), 1);
const onDay = (day: number) => format(setDate(STATEMENT_ANCHOR, day), "MM/dd/yyyy");
const STAGED_FILE = "e2e-staged.csv";
const STATEMENT = [
  "Account Type,Account Number,Transaction Date,Cheque Number,Description 1,Description 2,CAD$",
  `Chequing,1234,${onDay(3)},,E2E STAGED COFFEE,,-12.50`,
  `Chequing,1234,${onDay(4)},,E2E STAGED BOOKS,,-31.00`,
].join("\n");
const STAGED_ACTION = "Import 2 rows";
const IDLE_LINE = "Drop a statement here, or choose a file.";

const card = (page: Page) => page.getByTestId("finance-accounts-card");

/** The month holding the seed's newest Rewards card row, derived so no fixed month can rot. */
const CARD_ROW_MONTH = format(subDays(new Date(), 5), "yyyy-MM");

const SELECT_ALL_LABEL = "Select all transactions";

// Every row box, minus the header's — subtracted by its exact name, so a transaction whose own
// title starts with "all" still counts as a row.
const ledgerRows = (page: Page) =>
  page
    .getByRole("checkbox", { name: /^Select / })
    .and(page.locator(`:not([aria-label="${SELECT_ALL_LABEL}"])`));

async function filterByAccount(page: Page, label: string) {
  await page.getByRole("button", { name: "Filter by account" }).click();
  await page.getByRole("menuitem", { name: label, exact: true }).click();
}

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

/** The picker is a single-choice list, so its options are radios; the row-action menus are not. */
const pickerOption = (page: Page, name: string, exact = false) =>
  page.getByRole("menuitemradio", { name, exact });

async function chooseAccount(page: Page, name: string) {
  await openAccountPicker(page);
  await pickerOption(page, name, true).click();
}

async function stageStatement(page: Page) {
  await page.locator('input[type="file"]').setInputFiles({
    name: STAGED_FILE,
    mimeType: "text/csv",
    buffer: Buffer.from(STATEMENT),
  });
  await expect(page.getByRole("button", { name: STAGED_ACTION })).toBeVisible();
}

async function expectNothingStaged(page: Page) {
  await expect(page.getByRole("button", { name: STAGED_ACTION })).toBeHidden();
  await expect(page.getByText(IDLE_LINE)).toBeVisible();
  await expect(page.getByText(STAGED_FILE)).toHaveCount(0);
}

/**
 * A real drag-drop at the browser's input layer. `setInputFiles` drives the input's own change
 * handler and so can never reach the wrapper's drop guard — the path a browser would otherwise
 * answer by navigating the tab away to the dropped file.
 */
async function dropFileOn(page: Page, target: Locator, filePath: string) {
  const box = await target.boundingBox();
  if (box === null) throw new Error("the drop zone is not laid out, so nothing can be dropped");
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const session = await page.context().newCDPSession(page);
  const data = {
    items: [{ mimeType: "text/csv", data: STATEMENT }],
    files: [filePath],
    dragOperationsMask: 1,
  };
  for (const type of ["dragEnter", "dragOver", "drop"] as const) {
    await session.send("Input.dispatchDragEvent", { type, ...point, data });
  }
  await session.detach();
}

test("an account is created from the sidebar and offered as an import target", async ({ page }) => {
  await enterApp(page);
  await openImport(page);

  await createFromCard(page, "E2E Savings", "Savings");

  await expect(card(page).getByText("E2E Savings")).toBeVisible();
  await expect(card(page).getByText("Savings", { exact: true })).toBeVisible();

  await openAccountPicker(page);
  await expect(pickerOption(page, "E2E Savings")).toBeVisible();
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
  await expect(page.getByText("Used in duplicate keys, so it can’t change")).toBeVisible();
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
  await expect(pickerOption(page, "Everyday chequing")).toHaveCount(0);
  await expect(pickerOption(page, "New account…")).toBeVisible();
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
  await expect(pickerOption(page, "Everyday chequing")).toBeVisible();
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
  await pickerOption(page, "New account…").click();
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

test("a file dropped on the shut zone raises the guard rather than the browser", async ({
  page,
}) => {
  await enterApp(page);
  await openImport(page);

  for (const name of SEEDED) await archiveAccount(page, name);

  const directory = await mkdtemp(join(tmpdir(), "vega-e2e-drop-"));
  const filePath = join(directory, STAGED_FILE);
  await writeFile(filePath, STATEMENT, "utf8");
  try {
    await dropFileOn(page, page.locator('input[type="file"]'), filePath);

    await expect(page.getByText("Add an account before importing")).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/finance/import");
    await expect(page.getByRole("heading", { name: "Import", exact: true })).toBeVisible();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("a stage is discarded when its account is archived, and stays gone on restore", async ({
  page,
}) => {
  await enterApp(page);
  await openImport(page);

  await chooseAccount(page, "Rewards card");
  await stageStatement(page);
  await archiveAccount(page, "Rewards card");
  await expectNothingStaged(page);

  await chooseRowAction(page, "Rewards card", "Restore");
  await expectNothingStaged(page);

  // A restore resolves a different account too, so a stage made while it was gone goes the same way.
  await archiveAccount(page, "Rewards card");
  await stageStatement(page);
  await chooseRowAction(page, "Rewards card", "Restore");

  await expectNothingStaged(page);
});

test("a stage is discarded when the picker moves away, and stays gone on the way back", async ({
  page,
}) => {
  await enterApp(page);
  await openImport(page);

  await chooseAccount(page, "Rewards card");
  await stageStatement(page);

  await chooseAccount(page, "Everyday chequing");
  await expectNothingStaged(page);

  await chooseAccount(page, "Rewards card");

  await expectNothingStaged(page);
});

test("a blank or whitespace name never creates an account", async ({ page }) => {
  await enterApp(page);
  await openImport(page);

  await card(page).getByRole("button", { name: "New account" }).click();
  const create = page.getByRole("button", { name: "Create account" });
  const name = page.getByRole("textbox", { name: "Account name" });

  await expect(create).toBeDisabled();
  await name.fill("   ");
  await expect(create).toBeDisabled();

  await name.fill("E2E Named At Last");
  await expect(create).toBeEnabled();
});

test("renaming an archived account leaves it archived", async ({ page }) => {
  await enterApp(page);
  await openImport(page);

  await archiveAccount(page, "Rewards card");
  await chooseRowAction(page, "Rewards card", "Rename…");
  await page.getByRole("textbox", { name: "Account name" }).fill("E2E Retired Card");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("textbox", { name: "Account name" })).toBeHidden();

  await expect(card(page).getByText("E2E Retired Card")).toBeVisible();
  await expect(card(page).getByText("Archived")).toHaveCount(1);

  await openAccountPicker(page);
  await expect(pickerOption(page, "E2E Retired Card")).toHaveCount(0);
});

test("archiving an account leaves its transactions exactly where they are", async ({ page }) => {
  await enterApp(page);
  await page.goto(`/finance/transactions?month=${CARD_ROW_MONTH}`, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Transactions", exact: true })).toBeVisible({
    timeout: 15_000,
  });

  await filterByAccount(page, "Rewards card");
  const before = await ledgerRows(page).count();
  expect(before, "the seed files no Rewards card row in this month").toBeGreaterThan(0);

  await openImport(page);
  await archiveAccount(page, "Rewards card");

  await page.goto(`/finance/transactions?month=${CARD_ROW_MONTH}`, { waitUntil: "networkidle" });
  await filterByAccount(page, "Rewards card (archived)");
  await expect(ledgerRows(page)).toHaveCount(before);
});
