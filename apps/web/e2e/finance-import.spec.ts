import { expect, type Page, test } from "@playwright/test";
import { format, setDate, subMonths } from "date-fns";
import { enterApp } from "./helpers/app";

/**
 * The weekly loop's write path: a statement previews without touching storage, the same file
 * imported twice adds nothing, an unknown layout goes through the mapper, and a category
 * correction in the ledger's review lens teaches the merchant so the next import files itself.
 */

const rbcStatement = (rows: string[]) =>
  [
    "Account Type,Account Number,Transaction Date,Cheque Number,Description 1,Description 2,CAD$",
    ...rows,
  ].join("\n");

/**
 * Last month, never a fixed one: the seed settles the month two back, and a settled month freezes
 * every row in it — so a pinned statement date eventually imports rows this suite can't edit.
 */
const STATEMENT_ANCHOR = subMonths(new Date(), 1);
const onDay = (day: number) => format(setDate(STATEMENT_ANCHOR, day), "MM/dd/yyyy");
const isoOnDay = (day: number) => format(setDate(STATEMENT_ANCHOR, day), "yyyy-MM-dd");

const STATEMENT = rbcStatement([
  `Chequing,1234,${onDay(3)},,E2E COFFEE HOUSE,,-12.50`,
  `Chequing,1234,${onDay(4)},,E2E BOOK STORE,,-31.00`,
  `Chequing,1234,${onDay(5)},,E2E TICKET REFUND,,15.00`,
  `Chequing,1234,${onDay(6)},,PAYMENT - THANK YOU,,900.00`,
]);

const NEXT_WEEK = rbcStatement([`Chequing,1234,${onDay(10)},,E2E COFFEE HOUSE,,-9.00`]);

/** The ledger is month-scoped, so a search for an imported row has to name the month it lands in. */
const STATEMENT_MONTH = format(STATEMENT_ANCHOR, "yyyy-MM");

/** Headers no registry entry knows, so this file can only be read through the mapper. */
const UNKNOWN_LAYOUT = ["Posted,Merchant,Value", `${isoOnDay(6)},E2E CORNER SHOP,-8.25`].join("\n");
const UNKNOWN_DATE_LABEL = format(setDate(STATEMENT_ANCHOR, 6), "d MMMM yyyy");

async function dropStatement(page: Page, csv = STATEMENT) {
  await page.goto("/finance/import", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Import", exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await page.locator('input[type="file"]').setInputFiles({
    name: "e2e-statement.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
}

const lensOf = (page: Page, outcome: string) => page.getByTestId(`import-count-${outcome}`);

async function commitPreview(page: Page, rows: number) {
  await page.getByRole("button", { name: `Import ${rows} rows` }).click();
  await expect(page.getByRole("status")).toContainText(`Imported ${rows} transactions`);
}

async function searchLedger(page: Page, needle: string) {
  await page.goto(`/finance/transactions?month=${STATEMENT_MONTH}`, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Transactions", exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole("searchbox", { name: "Search transactions" }).fill(needle);
}

test("a preview reports every outcome and writes nothing until commit", async ({ page }) => {
  await enterApp(page);
  await dropStatement(page);

  await expect(page.getByText("e2e-statement.csv · 4 rows read, 4 new")).toBeVisible();
  await expect(lensOf(page, "will-add")).toContainText("4");
  await expect(lensOf(page, "already-here")).toContainText("0");
  // A card payment lands, but as internal — it moves money rather than spending it.
  await expect(lensOf(page, "internal")).toContainText("1");
  await expect(page.getByText("Nothing is written until you import.")).toBeVisible();
  await expect(page.getByText("internal transfer")).toBeVisible();

  // Leaving the page throws the staged import away — proof that nothing reached storage.
  await searchLedger(page, "E2E COFFEE HOUSE");
  await expect(page.getByText("No transactions match these filters")).toBeVisible();

  await dropStatement(page);
  await commitPreview(page, 4);

  await searchLedger(page, "E2E COFFEE HOUSE");
  await expect(page.getByText("No transactions match these filters")).toBeHidden();
  await expect(page.getByText("E2E COFFEE HOUSE")).toHaveCount(1);
});

test("re-importing the same file adds nothing", async ({ page }) => {
  await enterApp(page);
  await dropStatement(page);
  await commitPreview(page, 4);

  await dropStatement(page);
  await expect(lensOf(page, "already-here")).toContainText("4");
  await expect(lensOf(page, "will-add")).toContainText("0");
  await expect(page.getByRole("button", { name: "Import 0 rows" })).toBeDisabled();
  // Why nothing is landing, not just that nothing is landing.
  await expect(page.getByTestId("import-prior-file")).toContainText(
    "You already imported this exact file",
  );

  // The lens narrows the preview to the rows it counts.
  await lensOf(page, "already-here").click();
  await expect(page.getByText("E2E BOOK STORE")).toBeVisible();
  await lensOf(page, "will-add").click();
  await expect(page.getByText("No rows read this way.")).toBeVisible();

  await searchLedger(page, "E2E BOOK STORE");
  await expect(page.getByText("E2E BOOK STORE")).toHaveCount(1);
});

test("an unknown layout is mapped once and then previews", async ({ page }) => {
  await enterApp(page);
  await dropStatement(page, UNKNOWN_LAYOUT);

  const mapper = page.getByRole("dialog", { name: "Map statement columns" });
  await expect(mapper).toBeVisible();

  // The Columns card carries the same field names, so every mapper control is scoped to the dialog.
  const chooseInMapper = async (field: string, option: string) => {
    await mapper.getByRole("button", { name: field }).click();
    // The previous select's popover animates out, so wait until only the open one is mounted —
    // every column list offers the same header names and would otherwise match twice.
    await expect(page.getByRole("listbox")).toHaveCount(1);
    await page.getByRole("option", { name: option, exact: true }).click();
  };
  await chooseInMapper("Date column", "Posted");
  await chooseInMapper("Description column", "Merchant");
  await chooseInMapper("Amount column", "Value");
  await chooseInMapper("Date format", "YYYY-MM-DD");
  await expect(mapper.getByText(`${UNKNOWN_DATE_LABEL} (YYYY-MM-DD)`)).toBeVisible();

  await mapper.getByRole("button", { name: "Confirm mapping" }).click();
  await expect(mapper).toBeHidden();
  await expect(lensOf(page, "will-add")).toContainText("1");
  // The mapping the preview now reads by is stated in the Columns card, not hidden in the account.
  await expect(page.getByRole("button", { name: "Date column" })).toContainText("Posted");
});

test("a category correction in the ledger teaches the merchant, so the next import guesses it", async ({
  page,
}) => {
  await enterApp(page);
  await dropStatement(page);
  await commitPreview(page, 4);

  await page.getByRole("link", { name: "Review them" }).click();
  await expect(page).toHaveURL(/\?review=flagged$/);
  await page.getByRole("button", { name: "Category for E2E COFFEE HOUSE" }).click();
  await page.getByRole("menuitem", { name: "Groceries", exact: true }).click();

  await dropStatement(page, NEXT_WEEK);
  await expect(page.getByText("Groceries", { exact: true })).toBeVisible();
});
