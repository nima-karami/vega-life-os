import { expect, type Page, test } from "@playwright/test";

/**
 * The finance spine: the ⌘K search bar offers one finance destination — finance takes no nav
 * slot by design — and the in-page view strip reaches the other four routes from there.
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

const FINANCE_VIEWS = [
  { tab: "Overview", url: /\/finance$/, heading: "Finance" },
  { tab: "Transactions", url: /\/finance\/transactions$/, heading: "Transactions" },
  { tab: "Import", url: /\/finance\/import$/, heading: "Import statements" },
  { tab: "Categories & budgets", url: /\/finance\/categories$/, heading: "Categories" },
  { tab: "Settlement", url: /\/finance\/settlement$/, heading: "Settlement" },
];

/** Typing the concepts that used to be their own commands must still land on the one door. */
const FINANCE_QUERIES = ["finance", "settlement", "import statements", "budgets", "transactions"];

for (const query of FINANCE_QUERIES) {
  test(`the command bar offers one finance destination for "${query}"`, async ({ page }) => {
    await enterApp(page);
    const dialog = await openCommandBar(page, query);

    const financeOptions = dialog.getByRole("option", { name: /Money · month overview/ });
    await expect(financeOptions).toHaveCount(1);
    await expect(dialog.getByRole("option", { name: /Finance · / })).toHaveCount(0);

    await financeOptions.click();
    await expect(page).toHaveURL(/\/finance$/);
  });
}

for (const { tab, url, heading } of FINANCE_VIEWS) {
  test(`the view strip reaches ${heading} and the page renders`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

    await enterApp(page);
    const dialog = await openCommandBar(page, "finance");
    await dialog.getByRole("option", { name: /Money · month overview/ }).click();
    await expect(page).toHaveURL(/\/finance$/);

    const viewNav = page.getByRole("navigation", { name: "Finance views" });
    await expect(viewNav).toBeVisible({ timeout: 10_000 });
    await viewNav.getByRole("button", { name: tab }).click();

    await expect(page).toHaveURL(url);
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible({
      timeout: 10_000,
    });
    // The strip travels with the page and marks where you are.
    await expect(
      page.getByRole("navigation", { name: "Finance views" }).getByRole("button", { name: tab }),
    ).toHaveAttribute("aria-pressed", "true");
    // Wide layout, and a body that actually rendered rows from the sample data.
    await expect(page.locator("main .max-w-6xl").first()).toBeVisible();
    expect(errors, `runtime errors on ${heading}:\n${errors.join("\n")}`).toEqual([]);
  });
}

test("the view strip does not overflow the page at 320px", async ({ page }) => {
  await enterApp(page);
  await page.setViewportSize({ width: 320, height: 780 });
  await page.goto("/finance/settlement", { waitUntil: "networkidle" });
  await expect(page.getByRole("navigation", { name: "Finance views" })).toBeVisible({
    timeout: 15_000,
  });

  await expect
    .poll(
      () =>
        page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        ),
      { message: "finance page overflows horizontally at 320px", timeout: 5_000 },
    )
    .toBeLessThanOrEqual(1);
});

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
