import { expect, type Page, test } from "@playwright/test";
import { enterApp } from "./helpers/app";

/**
 * The weekly loop's write path: a statement previews without touching storage, the same file
 * imported twice adds nothing, an unknown layout goes through the mapper, and a category
 * correction teaches the merchant so the next import files itself.
 */

const rbcStatement = (rows: string[]) =>
  [
    "Account Type,Account Number,Transaction Date,Cheque Number,Description 1,Description 2,CAD$",
    ...rows,
  ].join("\n");

const STATEMENT = rbcStatement([
  "Chequing,1234,07/03/2026,,E2E COFFEE HOUSE,,-12.50",
  "Chequing,1234,07/04/2026,,E2E BOOK STORE,,-31.00",
  "Chequing,1234,07/05/2026,,E2E TICKET REFUND,,15.00",
]);

const NEXT_WEEK = rbcStatement(["Chequing,1234,07/10/2026,,E2E COFFEE HOUSE,,-9.00"]);

/** The ledger is month-scoped, so a search for an imported row has to name the month it lands in. */
const STATEMENT_MONTH = "2026-07";

/** Headers no registry entry knows, so this file can only be read through the mapper. */
const UNKNOWN_LAYOUT = ["Posted,Merchant,Value", "2026-07-06,E2E CORNER SHOP,-8.25"].join("\n");

async function dropStatement(page: Page, csv = STATEMENT) {
  await page.goto("/finance/import", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Import statements" })).toBeVisible({
    timeout: 15_000,
  });
  await page.locator('input[type="file"]').setInputFiles({
    name: "e2e-statement.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
}

const countOf = (page: Page, key: string) => page.getByTestId(`import-count-${key}`);

// A house Select trigger's accessible name is "<current value> <label>", so match the label
// as a substring rather than exactly.
async function chooseOption(page: Page, field: string, option: string) {
  await page.getByRole("button", { name: field }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

async function commitPreview(page: Page, rows: number) {
  await page.getByRole("button", { name: /that’s how this file reads/ }).click();
  await page.getByRole("button", { name: `Import ${rows} rows` }).click();
  await expect(page.getByRole("status")).toContainText(`Imported ${rows} transactions`);
}

async function searchLedger(page: Page, needle: string) {
  await page.goto(`/finance/transactions?month=${STATEMENT_MONTH}`, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Transactions" })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole("searchbox", { name: "Search transactions" }).fill(needle);
}

test("a preview reports the counts and writes nothing until commit", async ({ page }) => {
  await enterApp(page);
  await dropStatement(page);

  await expect(countOf(page, "newRows")).toHaveText("3");
  await expect(countOf(page, "duplicate")).toHaveText("0");
  await expect(page.getByText("Nothing is written until you press Import")).toBeVisible();

  // Leaving the page throws the staged import away — proof that nothing reached storage.
  await searchLedger(page, "E2E COFFEE HOUSE");
  await expect(page.getByText("No transactions match these filters")).toBeVisible();

  await dropStatement(page);
  await commitPreview(page, 3);

  await searchLedger(page, "E2E COFFEE HOUSE");
  await expect(page.getByText("No transactions match these filters")).toBeHidden();
  await expect(page.getByText("E2E COFFEE HOUSE")).toHaveCount(1);
});

test("re-importing the same file adds nothing", async ({ page }) => {
  await enterApp(page);
  await dropStatement(page);
  await commitPreview(page, 3);

  await dropStatement(page);
  await expect(countOf(page, "duplicate")).toHaveText("3");
  await expect(countOf(page, "newRows")).toHaveText("0");
  await expect(page.getByRole("button", { name: "Import 0 rows" })).toBeDisabled();
  // Why nothing is landing, not just that nothing is landing.
  await expect(page.getByTestId("import-prior-file")).toContainText(
    "You already imported this exact file",
  );

  await searchLedger(page, "E2E BOOK STORE");
  await expect(page.getByText("E2E BOOK STORE")).toHaveCount(1);
});

test("an unknown layout is mapped once and then previews", async ({ page }) => {
  await enterApp(page);
  await dropStatement(page, UNKNOWN_LAYOUT);

  const mapper = page.getByRole("dialog", { name: "Map statement columns" });
  await expect(mapper).toBeVisible();

  await chooseOption(page, "Date column", "Posted");
  await chooseOption(page, "Description column", "Merchant");
  await chooseOption(page, "Amount column", "Value");
  await chooseOption(page, "Date format", "YYYY-MM-DD");
  await expect(mapper.getByText("6 July 2026 (YYYY-MM-DD)")).toBeVisible();

  await mapper.getByRole("button", { name: "Confirm mapping" }).click();
  await expect(mapper).toBeHidden();
  await expect(countOf(page, "newRows")).toHaveText("1");
});

test("a category correction teaches the merchant, so the next import files itself", async ({
  page,
}) => {
  await enterApp(page);
  await dropStatement(page);
  await commitPreview(page, 3);

  const review = page.getByTestId("finance-review");
  await expect(review.getByText("E2E COFFEE HOUSE")).toHaveCount(1);
  await chooseOption(page, "Category for E2E COFFEE HOUSE", "Groceries");
  await expect(review.getByText("E2E COFFEE HOUSE")).toHaveCount(0);

  await dropStatement(page, NEXT_WEEK);
  await commitPreview(page, 1);
  await expect(page.getByTestId("finance-review").getByText("E2E COFFEE HOUSE")).toHaveCount(0);
});
