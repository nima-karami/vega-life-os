import { expect, type Page, test } from "@playwright/test";
import { enterApp } from "./helpers/app";

/**
 * The settlement screen's two load-bearing promises: a settled month shows the figure it was
 * settled at rather than whatever the live query says today, and a month the partner carried
 * states the direction in words instead of leaving it to a minus sign.
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

test("a settled month shows the figure it was frozen at, not the live one", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await enterApp(page);
  await openSettlement(page, settledMonth());

  await expect(page.getByText("Both sides of the month")).toBeVisible();
  await expect(page.getByText("$2,142.50")).toBeVisible();
  await expect(page.getByText("$86.00")).toBeVisible();
  await expect(page.getByText("$2,228.50")).toBeVisible();

  // Frozen at settle time. The live query nets the recorded payment and would read $0.00 here.
  await expect(page.getByText(/Settled at \$1,028\.25/)).toBeVisible();
  await expect(page.getByText("Nothing left to settle")).toBeVisible();
  await expect(page.getByRole("button", { name: "Re-settle" })).toBeHidden();

  expect(errors, `runtime errors:\n${errors.join("\n")}`).toEqual([]);
});

test("a month the partner carried says the owner owes, in words", async ({ page }) => {
  await enterApp(page);
  await openSettlement(page, partnerHeavyMonth());

  await expect(page.getByText(/You owe your partner/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark settled" })).toBeVisible();
});
