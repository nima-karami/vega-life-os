import { expect, type Page, test } from "@playwright/test";
import { enterApp } from "./helpers/app";

/**
 * The settlement screen's load-bearing promises: a settled period shows the figure it was settled
 * at rather than whatever the live query says today, the direction is always stated in words rather
 * than left to a minus sign, and the contributing rows add up to the figure the card leads with.
 */

const monthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

/** The sandbox seed settles the month two back and leaves everything since open. */
function settledMonth(): string {
  const now = new Date();
  return monthKey(new Date(now.getFullYear(), now.getMonth() - 2, 1));
}

/** The seed's partner-paid grocery run sits three days back, and nothing the owner paid outweighs it. */
function partnerHeavyMonth(): string {
  const date = new Date();
  date.setDate(date.getDate() - 3);
  return monthKey(date);
}

async function openSettlement(page: Page, month: string) {
  await page.goto(`/finance/settlement?month=${month}`, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Settlement", exact: true })).toBeVisible({
    timeout: 15_000,
  });
}

test("a settled period shows the figure it was frozen at, not the live one", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await enterApp(page);
  await openSettlement(page, settledMonth());

  const card = page.getByRole("region", { name: "The period being settled" });
  await expect(card.getByText("Partner owes you $1,028.25")).toBeVisible();
  await expect(card.getByText("$2,228.50 of shared purchases netted across 3 rows.")).toBeVisible();
  await expect(card.getByText("You paid $2,142.50")).toBeVisible();
  await expect(card.getByText("Partner paid $86.00")).toBeVisible();

  // Frozen at settle time, and the payment already recorded against it is stated beside it.
  await expect(card.getByText(/Settled at \$1,028\.25/)).toBeVisible();
  await expect(card.getByText(/\$1,028\.25 recorded as paid/)).toBeVisible();

  // A frozen period offers no settle button; it offers the ways out of a frozen figure.
  await expect(page.getByRole("button", { name: "Record settlement" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Reopen for editing" })).toBeVisible();

  expect(errors, `runtime errors:\n${errors.join("\n")}`).toEqual([]);
});

test("the contributing rows add up to the figure the card leads with", async ({ page }) => {
  await enterApp(page);
  await openSettlement(page, settledMonth());

  const rows = page.getByRole("region", { name: "Shared rows in this period" });
  await expect(rows.getByText("Rent")).toBeVisible();
  await expect(rows.getByText("3 rows counted")).toBeVisible();
  await expect(rows.getByText("+$1,028.25")).toBeVisible();

  // The filter chips narrow the same set rather than a different query.
  await rows.getByRole("button", { name: "Partner paid" }).click();
  await expect(rows.getByText("Dinner out")).toBeVisible();
  await expect(rows.getByText("Rent")).toBeHidden();
});

test("a period the partner carried says the owner owes, in words", async ({ page }) => {
  await enterApp(page);
  await openSettlement(page, partnerHeavyMonth());

  await expect(page.getByText(/You owe Partner/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Record settlement" })).toBeVisible();
});

test("the settled periods history states each outcome as a sentence", async ({ page }) => {
  await enterApp(page);
  await openSettlement(page, partnerHeavyMonth());

  const history = page.getByRole("region", { name: "Settled periods" });
  await expect(history.getByText(/Partner sent you/).first()).toBeVisible();
  await expect(history.getByText("$1,028.25").first()).toBeVisible();
});
