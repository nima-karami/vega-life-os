import { expect, type Page, test } from "@playwright/test";
import { enterApp } from "./helpers/app";

/**
 * A long ledger: rows sit under the day they landed on, every day states its two
 * figures honestly, the review lens triages a row in place, and a settled month says why it can't
 * be touched. The sandbox seeds its rows relative to today, so every test names the month it wants.
 */

const toMonthKey = (moment: Date) =>
  `${moment.getFullYear()}-${String(moment.getMonth() + 1).padStart(2, "0")}`;

/** The month a seeded row landed in — the seed dates every row back from today. */
function monthOfDaysAgo(days: number): string {
  const moment = new Date();
  moment.setDate(moment.getDate() - days);
  return toMonthKey(moment);
}

function monthShiftedBy(months: number): string {
  const moment = new Date();
  moment.setDate(1);
  moment.setMonth(moment.getMonth() + months);
  return toMonthKey(moment);
}

/** The partner-paid grocery run, 3 days back — the seed's most recent row. */
const RECENT_MONTH = monthOfDaysAgo(3);
/** The unknown merchant, 5 days back: no category, so it is the one row still needing review. */
const UNREVIEWED_DESCRIPTION = "SQ *8231 VENDOR 4417";

async function openLedger(page: Page, query = "") {
  await enterApp(page);
  await page.goto(`/finance/transactions${query}`, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Transactions", exact: true })).toBeVisible({
    timeout: 15_000,
  });
}

// "Select all transactions" is the header box; the rest are one per row.
const rowBoxes = (page: Page) => page.getByRole("checkbox", { name: /^Select (?!all)/ });

// React Aria keeps the real checkbox visually hidden behind its styled control, so the hit-target
// check lands on the wrapping label. Forcing the click is how this codebase drives one.
const check = (page: Page, name: string) =>
  page.getByRole("checkbox", { name }).click({ force: true });

const rowCategory = (page: Page, title: string) =>
  page.getByRole("button", { name: `Category for ${title}` });

test("rows sit under their day, and the day states both of its figures", async ({ page }) => {
  await openLedger(page, `?month=${RECENT_MONTH}`);

  await expect(page.getByRole("link", { name: "Groceries (her run)" })).toBeVisible();
  // A half-share row: the full charge is context, the owner's share is the headline.
  await expect(page.getByText("$112.00", { exact: true })).toBeVisible();
  await expect(page.getByText("$56.00", { exact: true })).toBeVisible();
  await expect(page.getByText(/^\$112\.00 · your share \$56\.00$/)).toBeVisible();
  await expect(page.getByText("shared · 50% mine").first()).toBeVisible();

  // The header sub-line names both money figures and labels each.
  await expect(
    page.getByText(/rows? in \w+ · \$[\d,.]+ out, \$[\d,.]+ against budgets/),
  ).toBeVisible();
});

test("an unreviewed row is shown but left out of its day's figures", async ({ page }) => {
  await openLedger(page, "?review=flagged");

  await expect(page.getByRole("link", { name: UNREVIEWED_DESCRIPTION })).toBeVisible();
  await expect(page.getByText("needs review").first()).toBeVisible();
  // Nothing in that day can be summed honestly, so the strip states the exclusion instead.
  await expect(page.getByText(/^\d+ unreviewed$/)).toBeVisible();
});

test("the review lens triages the row in place and empties the queue", async ({ page }) => {
  await openLedger(page, "?review=flagged");

  // The queue opens on its first row, triage already expanded — no extra click to start work.
  const done = page.getByRole("button", { name: "Done — next row" });
  await expect(done).toBeVisible();

  await page.getByRole("button", { name: `File ${UNREVIEWED_DESCRIPTION} under` }).click();
  await page.getByRole("option", { name: "Groceries", exact: true }).click();
  await done.click();

  // `no-category` derives from the row, so filing it empties the queue with no flag bookkeeping.
  await expect(rowBoxes(page)).toHaveCount(0);
  await expect(page.getByTestId("finance-review-badge")).toHaveCount(0);
});

test("a bulk category change lands on every selected row", async ({ page }) => {
  await openLedger(page, `?month=${monthShiftedBy(0)}`);

  const rowCount = await rowBoxes(page).count();
  expect(rowCount).toBeGreaterThan(1);

  await check(page, "Select all transactions");
  await expect(page.getByText(`${rowCount} selected`)).toBeVisible();

  await page.getByRole("button", { name: "Set category for selection" }).click();
  await page.getByRole("menuitem", { name: "Dining out", exact: true }).click();

  await expect(page.getByText("Dining out", { exact: true })).toHaveCount(rowCount);
});

test("shift-click selects the range between two rows", async ({ page }) => {
  // The settled month's three seeded rows are fixed calendar-day offsets from its own start, so
  // — unlike the recent rows — the count here never drifts with what day "today" happens to be.
  await openLedger(page, `?month=${monthShiftedBy(-2)}`);

  const boxes = rowBoxes(page);
  await expect(boxes).toHaveCount(3);

  await boxes.nth(0).click({ force: true });
  await page.keyboard.down("Shift");
  await boxes.nth(2).click({ force: true });
  await page.keyboard.up("Shift");

  await expect(page.getByText("3 selected")).toBeVisible();
});

test("a row's own category chip files it in one click", async ({ page }) => {
  await openLedger(page, `?month=${RECENT_MONTH}`);

  await rowCategory(page, "Groceries (her run)").click();
  await page.getByRole("menuitem", { name: "Dining out", exact: true }).click();
  await expect(rowCategory(page, "Groceries (her run)")).toHaveText("Dining out");
});

test("the Shared and Mine chips are one lens, not two filters", async ({ page }) => {
  await openLedger(page, `?month=${RECENT_MONTH}`);
  const sharedRow = page.getByRole("link", { name: "Groceries (her run)" });

  await page.getByRole("button", { name: "Mine", exact: true }).click();
  await expect(sharedRow).toHaveCount(0);

  await page.getByRole("button", { name: "Shared", exact: true }).click();
  await expect(sharedRow).toBeVisible();

  await page.getByRole("button", { name: "All", exact: true }).click();
  await expect(sharedRow).toBeVisible();
});

test("a row in a settled month is read-only and says why", async ({ page }) => {
  await openLedger(page, `?month=${monthShiftedBy(-2)}`);

  await expect(page.getByRole("link", { name: "Rent" })).toBeVisible();
  await expect(page.getByRole("img", { name: /is settled/ }).first()).toBeVisible();
  // A locked row wears its category as a plain chip — there is no picker to open.
  await expect(rowCategory(page, "Rent")).toHaveCount(0);
  await expect(page.getByText("Home & rent").first()).toBeVisible();
});
