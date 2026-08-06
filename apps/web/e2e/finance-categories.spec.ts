import { expect, type Page, test } from "@playwright/test";

/**
 * Category management: the owner names their own categories, budgets them month by month,
 * and can never hard-delete one the ledger still points at.
 */

async function passGratitudeGate(page: Page) {
  const gate = page.getByRole("button", { name: "Continue to today" });
  if (await gate.isVisible().catch(() => false)) {
    await page.getByRole("textbox", { name: "Grateful for, item 1" }).fill("e2e gratitude");
    await gate.click();
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const explore = page.getByRole("button", { name: /explore with sample data/i });
  const main = page.locator("main");
  await expect(explore.or(main)).toBeVisible({ timeout: 20_000 });
  if (await explore.isVisible().catch(() => false)) {
    await explore.click();
    await expect(main).toBeVisible({ timeout: 15_000 });
  }
  // The morning gratitude gate hard-redirects every route but /today and /journal/*.
  await passGratitudeGate(page);

  await page.goto("/finance/categories", { waitUntil: "domcontentloaded" });
  await passGratitudeGate(page);
  await expect(page.getByRole("heading", { name: "Categories", exact: true })).toBeVisible({
    timeout: 15_000,
  });
});

const rowFor = (page: Page, name: string) =>
  page.getByRole("listitem").filter({ hasText: name }).first();

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

  const row = rowFor(page, "E2E Utilities");
  await expect(row).toBeVisible();
  await expect(row).toContainText("0 transactions");
  await expect(row).toContainText("no budget");
});

test("a budget is written at the month on screen and leaves earlier months alone", async ({
  page,
}) => {
  await createCategory(page, "E2E Utilities");

  await openRowMenu(page, "E2E Utilities", "Edit");
  const dialog = page.getByRole("dialog", { name: "Category" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("textbox", { name: /^Budget for / }).fill("250");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();

  await expect(rowFor(page, "E2E Utilities")).toContainText("$0.00 of $250.00");

  // Budgets are sparse rows resolved as "the latest row at or before the month".
  await page.getByRole("button", { name: "Previous month" }).click();
  await expect(rowFor(page, "E2E Utilities")).toContainText("no budget");

  await page.getByRole("button", { name: "Next month" }).click();
  await expect(rowFor(page, "E2E Utilities")).toContainText("$0.00 of $250.00");
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
  await expect(rowFor(page, "Groceries")).toBeVisible();
});

test("merging moves every row into the target and archives the source", async ({ page }) => {
  const countRows = async (name: string) => {
    const text = await rowFor(page, name).innerText();
    return Number(/(\d+) transactions?/.exec(text)?.[1] ?? "0");
  };
  const source = await countRows("Groceries");
  const target = await countRows("Dining out");
  expect(source).toBeGreaterThan(0);

  await openRowMenu(page, "Groceries", "Merge into…");
  const merge = page.getByRole("dialog", { name: "Merge Groceries into…" });
  await merge.getByRole("button", { name: /Pick a category/ }).click();
  await page.getByRole("option", { name: /^Dining out/ }).click();
  await merge.getByRole("button", { name: "Merge", exact: true }).click();
  await expect(merge).toBeHidden();

  await expect(rowFor(page, "Dining out")).toContainText(`${source + target} transactions`);
  await expect(rowFor(page, "Groceries")).toBeHidden();
  await expect(page.getByRole("button", { name: /Show archived \(1\)/ })).toBeVisible();
});
