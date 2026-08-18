import { expect, type Page, test } from "@playwright/test";
import { enterApp, passGratitudeGate } from "./helpers/app";

/**
 * Category management: the owner names their own categories, budgets them in the row they are
 * judged in, drills into one for its own page, and can never hard-delete one the ledger points at.
 */

test.beforeEach(async ({ page }) => {
  await enterApp(page);
  await page.goto("/finance/categories", { waitUntil: "domcontentloaded" });
  await passGratitudeGate(page);
  await expect(page.getByRole("heading", { name: "Categories", exact: true })).toBeVisible({
    timeout: 15_000,
  });
});

const rowLink = (page: Page, name: string) =>
  page.getByRole("link", { name: new RegExp(`^${name}\\b`) }).first();

const budgetChip = (page: Page, name: string) =>
  page.getByRole("button", { name: `Monthly budget for ${name}` });

async function createCategory(page: Page, name: string) {
  await page.getByRole("button", { name: "New category" }).first().click();
  const dialog = page.getByRole("dialog", { name: "New category" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("textbox", { name: "Category name" }).fill(name);
  await dialog.getByRole("button", { name: "Create category" }).click();
  await expect(dialog).toBeHidden();
}

async function openRowMenu(page: Page, name: string, item: string) {
  await page.getByRole("button", { name: `Actions for ${name}` }).click();
  await page.getByRole("menuitem", { name: item }).click();
}

test("creates a user-defined category — nothing is seeded for them", async ({ page }) => {
  await createCategory(page, "E2E Utilities");

  await expect(rowLink(page, "E2E Utilities")).toContainText("0 rows");
  await expect(budgetChip(page, "E2E Utilities")).toContainText("Set");
});

test("the budget is edited in the row it is judged in, and survives a reload", async ({ page }) => {
  await createCategory(page, "E2E Utilities");

  await budgetChip(page, "E2E Utilities").click();
  const field = page.getByRole("textbox", { name: "Monthly budget for E2E Utilities" });
  await field.fill("250");
  await field.press("Enter");
  await expect(budgetChip(page, "E2E Utilities")).toContainText("$250.00");

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(budgetChip(page, "E2E Utilities")).toContainText("$250.00");

  // Escape abandons an edit rather than committing whatever was typed.
  await budgetChip(page, "E2E Utilities").click();
  await page.getByRole("textbox", { name: "Monthly budget for E2E Utilities" }).fill("999");
  await page.keyboard.press("Escape");
  await expect(budgetChip(page, "E2E Utilities")).toContainText("$250.00");
});

test("the total row totals every column that can be totalled", async ({ page }) => {
  const total = page.getByText("Total", { exact: true }).locator("..");
  await expect(total).toContainText(/% spent, \d+% through the month/);
  await expect(total).toContainText("$2,850.00");
});

test("a category opens as its own page, with the honest twelve-month read", async ({ page }) => {
  await rowLink(page, "Groceries").click();

  await expect(page.getByRole("heading", { name: "Groceries", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: /months against budget/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Where it goes" })).toBeVisible();
  await expect(page.getByText(/completed months? · average/)).toBeVisible();

  // The range control is a pressed-state ButtonGroup, never Tabs.
  const twelve = page.getByRole("button", { name: "12 mo" });
  const six = page.getByRole("button", { name: "6 mo" });
  await expect(twelve).toHaveAttribute("aria-pressed", "true");
  await six.click();
  await expect(six).toHaveAttribute("aria-pressed", "true");
  await expect(twelve).toHaveAttribute("aria-pressed", "false");

  await page.getByRole("link", { name: "Categories" }).first().click();
  await expect(page.getByRole("heading", { name: "Categories", exact: true })).toBeVisible();
});

test("a deep link to a category that is gone says so instead of failing", async ({ page }) => {
  await page.goto("/finance/categories/fcat_missing", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("That category is gone")).toBeVisible();
});

test("delete is refused while the category is referenced, and offers archive or merge", async ({
  page,
}) => {
  await openRowMenu(page, "Groceries", "Delete");

  const dialog = page.getByRole("dialog", { name: "Can't delete Groceries" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(
    /\d+ transactions? (and \d+ merchant defaults? )?still use this category/,
  );
  await expect(dialog.getByRole("button", { name: "Archive" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Merge into…" })).toBeVisible();

  // Merge names what it moves and says plainly that it is one-way.
  await dialog.getByRole("button", { name: "Merge into…" }).click();
  const merge = page.getByRole("dialog", { name: "Merge Groceries into…" });
  await expect(merge).toBeVisible();
  await expect(merge).toContainText("This cannot be undone.");
  await expect(merge.getByRole("button", { name: "Merge", exact: true })).toBeDisabled();

  // Groceries is still there — nothing was deleted.
  await merge.getByRole("button", { name: "Cancel" }).click();
  await expect(rowLink(page, "Groceries")).toBeVisible();
});

test("merging moves every row into the target and archives the source", async ({ page }) => {
  await expect(rowLink(page, "Groceries")).toContainText("2 rows");
  await expect(rowLink(page, "Dining out")).toContainText("0 rows");

  await openRowMenu(page, "Groceries", "Merge into…");
  const merge = page.getByRole("dialog", { name: "Merge Groceries into…" });
  await merge.getByRole("button", { name: /Pick a category/ }).click();
  await page.getByRole("option", { name: /^Dining out/ }).click();
  await merge.getByRole("button", { name: "Merge", exact: true }).click();
  await expect(merge).toBeHidden();

  await expect(rowLink(page, "Dining out")).toContainText("2 rows");
  await expect(rowLink(page, "Groceries")).toBeHidden();
  await expect(page.getByRole("button", { name: /Show archived \(1\)/ })).toBeVisible();
});
