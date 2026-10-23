import { expect, type Page } from "@playwright/test";
import { test } from "./fixtures";
import { enterApp } from "./helpers/app";

/**
 * The in-month capture loop: the partner reports a purchase, the owner types it into ⌘K, and the
 * row lands in the ledger carrying no account. Asserted against the stored row, not the ledger's
 * markup, because what a later import has to recognise is the record — not the pixels.
 */

const COMMAND_PLACEHOLDER = "Search, navigate, or ask…";

interface StoredTransaction {
  description: string;
  accountId: string | null;
  amountCents: number;
  payer: string;
  enteredBy: string;
  source: string;
  dedupeKey: string | null;
  isHousehold: boolean;
  myShareBps: number;
  categoryId: string | null;
  reviewFlags: string[];
}

async function openQuickAdd(page: Page, query: string) {
  await page.getByTestId("omni-trigger").click();
  await expect(page.getByRole("dialog", { name: "Command bar" })).toBeVisible({ timeout: 10_000 });
  await page.getByPlaceholder(COMMAND_PLACEHOLDER).fill(query);
  // Free text matches no command, so the capture lives in the empty state.
  await page.getByRole("button", { name: /as an expense/ }).click();

  await expect(page).toHaveURL(/\/finance\/transactions$/);
  const modal = page.getByRole("dialog");
  await expect(modal.getByRole("textbox", { name: "Amount" })).toBeVisible({ timeout: 10_000 });
  return modal;
}

function readStoredTransactions(page: Page) {
  return page.evaluate(
    () =>
      new Promise<StoredTransaction[]>((resolve, reject) => {
        const request = indexedDB.open("vega-life-os");
        request.onsuccess = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains("financeTransactions")) return resolve([]);
          const read = db.transaction("financeTransactions", "readonly");
          const all = read.objectStore("financeTransactions").getAll();
          all.onsuccess = () => resolve(all.result as StoredTransaction[]);
          all.onerror = () => reject(all.error);
        };
        request.onerror = () => reject(request.error);
      }),
  );
}

test("⌘K free text prefills the quick-add", async ({ page }) => {
  await enterApp(page);
  const modal = await openQuickAdd(page, "Espresso 4.50");

  await expect(modal.getByRole("textbox", { name: "Amount" })).toHaveValue("4.50");
  await expect(modal.getByRole("textbox", { name: "Description" })).toHaveValue("Espresso");
  // Household, share and spread stay out of the way until they're asked for.
  await expect(modal.getByRole("textbox", { name: "My share percent" })).toBeHidden();
});

test("a partner-paid household expense lands in the ledger with no account", async ({ page }) => {
  await enterApp(page);
  const modal = await openQuickAdd(page, "Pantryco 112.00");

  await modal.getByRole("button", { name: "Partner", exact: true }).click();
  await expect(modal.getByRole("textbox", { name: "My share percent" })).toHaveValue("50");
  await expect(modal.getByRole("button", { name: "Household", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await modal.getByRole("button", { name: "Add expense", exact: true }).click();
  await expect(modal).toBeHidden();

  await expect(page.locator("main").getByText("Pantryco").first()).toBeVisible({ timeout: 10_000 });

  await expect
    .poll(
      async () => {
        const rows = await readStoredTransactions(page);
        return rows.find((row) => row.description === "Pantryco") ?? null;
      },
      { timeout: 10_000 },
    )
    .toMatchObject({
      accountId: null,
      amountCents: -11200,
      payer: "partner",
      enteredBy: "partner-reported",
      source: "manual",
      dedupeKey: null,
      isHousehold: true,
      myShareBps: 5000,
      // `no-category` is derived from the null categoryId, so nothing is stored here.
      categoryId: null,
      reviewFlags: [],
    });
});

test("the quick-add refuses to submit an unreadable amount", async ({ page }) => {
  await enterApp(page);
  const modal = await openQuickAdd(page, "zzz-no-such-command");

  const amount = modal.getByRole("textbox", { name: "Amount" });
  const submit = modal.getByRole("button", { name: "Add expense", exact: true });
  await expect(submit).toBeDisabled();

  await amount.fill("not money");
  await expect(modal.getByRole("alert")).toContainText("Enter an amount");
  await expect(submit).toBeDisabled();

  await amount.fill("12.30");
  await expect(submit).toBeEnabled();

  await modal.getByRole("textbox", { name: "Description" }).fill("");
  await expect(submit).toBeDisabled();
});
