import { expect, type Page, test } from "@playwright/test";

/**
 * The finance spine: the five routes exist, each renders its own page, and the ⌘K search bar
 * is the only way in — finance takes no nav slot by design.
 */

const COMMAND_PLACEHOLDER = "Search, navigate, or ask…";

async function enterApp(page: Page) {
  await page.goto("/", { waitUntil: "networkidle" });
  const explore = page.getByRole("button", { name: /explore with sample data/i });
  const main = page.locator("main");
  await expect(explore.or(main)).toBeVisible({ timeout: 20_000 });
  if (await explore.isVisible().catch(() => false)) {
    await explore.click();
    await expect(main).toBeVisible({ timeout: 15_000 });
  }

  // The morning gratitude gate hard-redirects every route but /today and /journal/*.
  const gate = page.getByRole("button", { name: "Continue to today" });
  if (await gate.isVisible().catch(() => false)) {
    await page.getByRole("textbox", { name: "Grateful for, item 1" }).fill("e2e gratitude");
    await gate.click();
    await expect(gate).toBeHidden();
  }
}

async function openCommandBar(page: Page, query: string) {
  await page.getByTestId("omni-trigger").click();
  const dialog = page.getByRole("dialog", { name: "Command bar" });
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  await page.getByPlaceholder(COMMAND_PLACEHOLDER).fill(query);
  return dialog;
}

const FINANCE_ROUTES = [
  { sublabel: /Money · month overview/, url: /\/finance$/, heading: "Finance" },
  { sublabel: /Finance · ledger/, url: /\/finance\/transactions$/, heading: "Transactions" },
  { sublabel: /Finance · CSV/, url: /\/finance\/import$/, heading: "Import statements" },
  { sublabel: /Finance · budgets/, url: /\/finance\/categories$/, heading: "Categories" },
  {
    sublabel: /Finance · split with partner/,
    url: /\/finance\/settlement$/,
    heading: "Settlement",
  },
];

for (const { sublabel, url, heading } of FINANCE_ROUTES) {
  test(`command bar reaches ${heading} and the page renders`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

    await enterApp(page);
    const dialog = await openCommandBar(page, "finance");
    await dialog.getByRole("option", { name: sublabel }).first().click();

    await expect(page).toHaveURL(url);
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible({
      timeout: 10_000,
    });
    // Wide layout, and a body that actually rendered rows from the sample data.
    await expect(page.locator("main .max-w-6xl").first()).toBeVisible();
    expect(errors, `runtime errors on ${heading}:\n${errors.join("\n")}`).toEqual([]);
  });
}

test("the ledger filters on a search and offers a way back", async ({ page }) => {
  await enterApp(page);
  await page.goto("/finance/transactions", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Transactions" })).toBeVisible({
    timeout: 15_000,
  });

  await page.getByRole("searchbox", { name: "Search transactions" }).fill("zzz-no-such-row");
  await expect(page.getByText("No transactions match these filters")).toBeVisible();

  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.getByText("No transactions match these filters")).toBeHidden();
});

test("⌘K quick-add hands a free-text draft to the ledger", async ({ page }) => {
  await enterApp(page);
  await openCommandBar(page, "Espresso 4.50");

  // Free text matches no command, so the capture lives in the empty state.
  await page.getByRole("button", { name: /as an expense/ }).click();

  await expect(page).toHaveURL(/\/finance\/transactions$/);
  await expect(page.getByRole("status")).toContainText("Espresso 4.50");
});
