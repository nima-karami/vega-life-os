import { expect, type Page, test } from "@playwright/test";
import { format, startOfMonth, subMonths } from "date-fns";
import { enterApp, passGratitudeGate } from "./helpers/app";

/**
 * The finance dashboard against the synthetic sandbox seed. The seed anchors its settled month
 * to `startOfMonth(now - 2 months)`, so that month's figures are the same whatever day it is —
 * the current month's are not, and are only ever compared, never asserted exactly.
 */

const SETTLED_LABEL = format(startOfMonth(subMonths(new Date(), 2)), "MMMM yyyy");
const TODAY = format(new Date(), "yyyy-MM-dd");

const UNBUDGETED = { id: "fcat_e2e_unbudgeted", name: "E2E unbudgeted", order: 90 };
const QUIET = { id: "fcat_e2e_quiet", name: "E2E quiet", order: 91 };

async function gotoDashboard(page: Page) {
  await page.goto("/finance", { waitUntil: "networkidle" });
  await passGratitudeGate(page);
  if (!/\/finance$/.test(page.url())) await page.goto("/finance", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Finance", exact: true })).toBeVisible({
    timeout: 10_000,
  });
}

async function openDashboard(page: Page) {
  await enterApp(page);
  await gotoDashboard(page);
}

/**
 * The untracked state needs a category that spends with no budget in force, which the seed
 * deliberately doesn't carry. Written straight into the sandbox's Dexie store so the test owns
 * its own setup and can't be broken by a later change to the seed.
 */
async function seedUnbudgetedSpend(page: Page, spentCents: number) {
  await page.evaluate(
    async (setup) => {
      const meta = { updatedAt: "", fieldUpdatedAt: {} };
      const category = (entry: { id: string; name: string; order: number }) => ({
        ...entry,
        kind: "spend",
        archivedAt: null,
        ...meta,
      });
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("vega-life-os");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise<void>((resolve, reject) => {
        const tx = database.transaction(["financeCategories", "financeTransactions"], "readwrite");
        const categories = tx.objectStore("financeCategories");
        categories.put(category(setup.unbudgeted));
        categories.put(category(setup.quiet));
        tx.objectStore("financeTransactions").put({
          id: "ftxn_e2e_unbudgeted",
          dedupeKey: null,
          accountId: "facc_chequing",
          txnDate: setup.txnDate,
          spreadMonths: 1,
          description: "E2E UNBUDGETED SPEND",
          amountCents: -setup.spentCents,
          currency: "CAD",
          originalAmountCents: null,
          originalCurrency: null,
          categoryId: setup.unbudgeted.id,
          merchantId: null,
          payer: "me",
          isHousehold: false,
          myShareBps: 10000,
          isInternal: false,
          source: "manual",
          enteredBy: "me",
          importBatchId: null,
          sourceRowNumber: null,
          refundOfTransactionId: null,
          reviewFlags: [],
          resolvedFlags: [],
          note: "",
          createdAt: setup.txnDate,
          ...meta,
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      database.close();
    },
    { unbudgeted: UNBUDGETED, quiet: QUIET, txnDate: TODAY, spentCents },
  );
}

const cashStrip = (page: Page) => page.getByRole("region", { name: "Cash on your accounts" });
const budgetSection = (page: Page) => page.getByRole("region", { name: "Budget vs actual" });
const untrackedSection = (page: Page) => page.getByRole("region", { name: "Untracked categories" });

// Each step waits for its own month to land — clicking twice in a row races the cursor's
// state under worker contention and silently leaves the dashboard a month short.
async function stepBack(page: Page, months: number) {
  for (let step = 1; step <= months; step += 1) {
    const landing = format(startOfMonth(subMonths(new Date(), step)), "MMMM yyyy");
    await page.getByRole("button", { name: "Previous month" }).click();
    await expect(page.getByText(landing, { exact: true })).toBeVisible();
  }
}

test("the dashboard renders budget vs actual against the seed", async ({ page }) => {
  await openDashboard(page);
  await stepBack(page, 2);
  await expect(page.getByText(SETTLED_LABEL, { exact: true })).toBeVisible();

  await expect(cashStrip(page)).toContainText("$2,142.50");
  await expect(
    budgetSection(page).getByRole("progressbar", {
      name: "Groceries: $71.25 borne of $500.00 budgeted",
    }),
  ).toBeVisible();
  await expect(
    budgetSection(page).getByRole("progressbar", {
      name: "Home & rent: $1,000.00 borne of $2,000.00 budgeted",
    }),
  ).toBeVisible();
  await expect(untrackedSection(page)).toBeHidden();
});

test("changing the month changes the figures", async ({ page }) => {
  await openDashboard(page);
  await expect(budgetSection(page)).toContainText("Month-end figures are an estimate");
  const thisMonthCash = await cashStrip(page).innerText();

  await stepBack(page, 2);
  await expect(page.getByText(SETTLED_LABEL, { exact: true })).toBeVisible();
  const settledCash = await cashStrip(page).innerText();
  expect(settledCash).not.toBe(thisMonthCash);
  expect(settledCash).toContain("$2,142.50");

  // A past month has no run rate left to project, so the estimate caveat goes with it.
  await expect(budgetSection(page)).not.toContainText("Month-end figures are an estimate");

  await page.getByRole("button", { name: "This month" }).click();
  await expect(page.getByRole("button", { name: "This month" })).toBeHidden();
  expect(await cashStrip(page).innerText()).toBe(thisMonthCash);
});

test("a category spending with no budget shows as untracked with a way to set one", async ({
  page,
}) => {
  await openDashboard(page);
  await seedUnbudgetedSpend(page, 6400);
  await gotoDashboard(page);

  // The partial state is budgeted rows AND untracked ones on the same screen.
  await expect(
    budgetSection(page).getByRole("progressbar", { name: /^Groceries: / }),
  ).toBeVisible();

  const untracked = untrackedSection(page);
  await expect(untracked).toBeVisible();
  await expect(untracked).toContainText(UNBUDGETED.name);
  await expect(untracked).toContainText("$64.00");
  // No budget and nothing spent is not drift — it never reaches this list.
  await expect(untracked).not.toContainText(QUIET.name);

  const setBudget = untracked.getByRole("button", { name: `Set a budget for ${UNBUDGETED.name}` });
  await expect(setBudget).toBeVisible();
  await setBudget.click();
  await expect(page).toHaveURL(new RegExp(`/finance/categories\\?category=${UNBUDGETED.id}$`));
});
