import { expect, type Page, test } from "@playwright/test";
import { enterApp } from "./helpers/app";

/**
 * The finance spine: the ⌘K search bar offers one finance destination — finance takes no nav
 * slot by design — and the in-page view strip reaches the other four routes from there, carrying
 * the review badge with it.
 */

const COMMAND_PLACEHOLDER = "Search, navigate, or ask…";

async function openCommandBar(page: Page, query: string) {
  await page.getByTestId("omni-trigger").click();
  const dialog = page.getByRole("dialog", { name: "Command bar" });
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  await page.getByPlaceholder(COMMAND_PLACEHOLDER).fill(query);
  return dialog;
}

const viewNav = (page: Page) => page.getByRole("navigation", { name: "Finance views" });

/** The strip's five cells, in the order they must read left to right. */
const FINANCE_VIEWS = [
  { tab: "Overview", url: /\/finance$/, heading: "Finance" },
  { tab: "Transactions", url: /\/finance\/transactions$/, heading: "Transactions" },
  { tab: "Categories", url: /\/finance\/categories$/, heading: "Categories" },
  { tab: "Settlement", url: /\/finance\/settlement$/, heading: "Settlement" },
  { tab: "Import", url: /\/finance\/import$/, heading: "Import statements" },
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

test("the strip names the five views in order", async ({ page }) => {
  await enterApp(page);
  await page.goto("/finance", { waitUntil: "networkidle" });
  await expect(viewNav(page)).toBeVisible({ timeout: 15_000 });

  const cells = viewNav(page).getByRole("button");
  await expect(cells).toHaveCount(FINANCE_VIEWS.length);
  for (const [index, view] of FINANCE_VIEWS.entries()) {
    await expect(cells.nth(index)).toContainText(view.tab);
  }
});

for (const { tab, url, heading } of FINANCE_VIEWS) {
  test(`the view strip reaches ${heading} and the page renders`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

    await enterApp(page);
    const dialog = await openCommandBar(page, "finance");
    await dialog.getByRole("option", { name: /Money · month overview/ }).click();
    await expect(page).toHaveURL(/\/finance$/);

    await expect(viewNav(page)).toBeVisible({ timeout: 10_000 });
    await viewNav(page).getByRole("button", { name: tab }).click();

    await expect(page).toHaveURL(url);
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible({
      timeout: 10_000,
    });
    // The strip travels with the page and marks where you are.
    await expect(viewNav(page).getByRole("button", { name: tab })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // Wide layout, and a body that actually rendered rows from the sample data.
    await expect(page.locator("main .max-w-6xl").first()).toBeVisible();
    expect(errors, `runtime errors on ${heading}:\n${errors.join("\n")}`).toEqual([]);
  });
}

test("the review badge counts the rows still needing the owner and travels with the strip", async ({
  page,
}) => {
  await enterApp(page);
  await page.goto("/finance", { waitUntil: "networkidle" });
  await expect(viewNav(page)).toBeVisible({ timeout: 15_000 });

  // The sandbox seed leaves exactly one imported row with no category.
  await expect(page.getByTestId("finance-review-badge")).toHaveText("1");

  await page.goto("/finance/settlement", { waitUntil: "networkidle" });
  await expect(page.getByTestId("finance-review-badge")).toHaveText("1");
});

test("the overview explains the review work and links into the pre-filtered ledger", async ({
  page,
}) => {
  await enterApp(page);
  await page.goto("/finance", { waitUntil: "networkidle" });
  await expect(viewNav(page)).toBeVisible({ timeout: 15_000 });

  await expect(page.getByText(/^1 row .*needs a category or a split$/)).toBeVisible();

  await page.getByRole("link", { name: "Review 1 row" }).click();
  await expect(page).toHaveURL(/\/finance\/transactions\?review=flagged$/);
  // The chip carries the same count the badge does, so its name is not the bare label.
  await expect(page.getByRole("button", { name: /^Needs review/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // Only the overview carries the explainer; elsewhere the badge alone is the prompt.
  await expect(page.getByRole("link", { name: /^Review \d+ rows?$/ })).toHaveCount(0);
});

test("a routed detail page swaps the strip for a back link", async ({ page }) => {
  await enterApp(page);
  await page.goto("/finance/transactions/new", { waitUntil: "networkidle" });

  // The entry form's h1 *is* the editable title field, so the page announces itself by that field
  // and its one accent button rather than by a static heading.
  await expect(page.getByRole("textbox", { name: "Transaction title" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole("button", { name: "Add transaction" })).toBeVisible();
  await expect(viewNav(page)).toHaveCount(0);

  await page.getByRole("link", { name: "Transactions" }).click();
  await expect(page).toHaveURL(/\/finance\/transactions$/);
});

test("the view strip does not overflow the page at 320px", async ({ page }) => {
  await enterApp(page);
  await page.setViewportSize({ width: 320, height: 780 });
  await page.goto("/finance/settlement", { waitUntil: "networkidle" });
  await expect(viewNav(page)).toBeVisible({ timeout: 15_000 });

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
