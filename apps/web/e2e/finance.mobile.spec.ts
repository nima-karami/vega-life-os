import { expect, type Locator, type Page, test } from "@playwright/test";
import { format, setDate, subMonths } from "date-fns";
import { enterApp } from "./helpers/app";
import { clearFinanceStores } from "./helpers/finance";

/**
 * The five finance grids drop their fixed columns for stacked rows on a phone. The desktop specs
 * run at 1280 in the chromium project and never reach that branch; the `.mobile.spec.ts` suffix
 * routes this file into the Pixel 7 project instead.
 */

const PHONE = { width: 390, height: 844 };

const monthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

/** The seed's partner-paid grocery run sits three days back — derived, never a pinned month. */
function partnerHeavyMonth(): string {
  const date = new Date();
  date.setDate(date.getDate() - 3);
  return monthKey(date);
}

const STATEMENT_ANCHOR = subMonths(new Date(), 1);
const onDay = (day: number) => format(setDate(STATEMENT_ANCHOR, day), "MM/dd/yyyy");

const STATEMENT = [
  "Account Type,Account Number,Transaction Date,Cheque Number,Description 1,Description 2,CAD$",
  `Chequing,1234,${onDay(3)},,E2E PHONE COFFEE,,-12.50`,
  `Chequing,1234,${onDay(4)},,E2E PHONE BOOKS,,-31.00`,
].join("\n");

async function openPhone(page: Page, route: string) {
  await enterApp(page);
  await page.setViewportSize(PHONE);
  await page.goto(route, { waitUntil: "domcontentloaded" });
  await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });
}

/**
 * Every element inside `selector` that is wider than the viewport — the shape a fixed-column grid
 * takes on a phone, and the thing a compact twin exists to remove. The view strip is left out on
 * purpose: it is deliberately scrollable, it bleeds into the shell's padding, and the page-level
 * sweep in `mobile.spec.ts` is what holds the frame around it.
 */
async function tooWideInside(page: Page, selector: string): Promise<string[]> {
  return page.evaluate((sel) => {
    const root = document.querySelector(sel);
    if (root === null) return [`nothing matched ${sel}`];
    const strip = document.querySelector('nav[aria-label="Finance views"]');
    const limit = document.documentElement.clientWidth + 1;

    const wide: string[] = [];
    for (const element of root.querySelectorAll("*")) {
      if (strip !== null && (element.contains(strip) || strip.contains(element))) continue;
      if (element.getBoundingClientRect().width > limit) {
        wide.push(`${element.tagName}[${element.getAttribute("class") ?? ""}]`);
      }
    }
    return wide;
  }, selector);
}

const region = (page: Page, name: string) => page.getByRole("region", { name });

const TOUCH_MINIMUM = 44;

async function expectThumbSized(target: Locator, label: string) {
  await expect(target).toBeVisible();
  const box = await target.boundingBox();
  expect(box?.height ?? 0, label + " is under the 44px phone minimum").toBeGreaterThanOrEqual(
    TOUCH_MINIMUM,
  );
}

test("the category table stacks, and every row action survives the drop", async ({ page }) => {
  await openPhone(page, "/finance/categories");
  await expect(page.getByRole("heading", { name: "Categories", exact: true })).toBeVisible({
    timeout: 15_000,
  });

  // Software carries the annual licence, recognised in every month, so it is the one row the seed
  // guarantees regardless of today's date.
  const row = page.getByRole("link", { name: /^Software\b/ }).first();
  await expect(row).toContainText("1 row");
  await expect(page.getByRole("button", { name: "Monthly budget for Software" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Actions for Software" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Software" })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Software pace" })).toBeVisible();

  expect(await tooWideInside(page, "main")).toEqual([]);
});

test("the budget is still edited in the row, on a target a thumb can hit", async ({ page }) => {
  await openPhone(page, "/finance/categories");
  const chip = page.getByRole("button", { name: "Monthly budget for Software" });
  await expect(chip).toBeVisible({ timeout: 15_000 });

  const box = await chip.boundingBox();
  expect(
    box?.height ?? 0,
    "the budget chip is under the 44px phone minimum",
  ).toBeGreaterThanOrEqual(44);

  // Software already carries a $50 budget that carries forward, so only a distinctive figure tells
  // a working commit apart from a stale render.
  await chip.click();
  const field = page.getByRole("textbox", { name: "Monthly budget for Software" });
  await field.fill("777");
  await field.press("Enter");
  await expect(page.getByRole("button", { name: "Monthly budget for Software" })).toContainText(
    "$777.00",
  );
});

test("the row menu still offers every action the desktop row does", async ({ page }) => {
  await openPhone(page, "/finance/categories");
  await page.getByRole("button", { name: "Actions for Software" }).click();

  for (const item of ["Edit", "Merge into…", "Archive", "Delete"]) {
    await expect(page.getByRole("menuitem", { name: item })).toBeVisible();
  }
});

test("a category opens its own page and its rows card fits the column", async ({ page }) => {
  await openPhone(page, "/finance/categories");
  await page
    .getByRole("link", { name: /^Software\b/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/finance\/categories\/[^/]+$/);

  // The detail page hard-wires this month with no cursor, and Software's only row sits 20 days back,
  // so for most of a month the honest assertion is "rows or the empty string" — never a date bomb.
  const rows = region(page, "Rows in this category");
  await expect(rows).toBeVisible({ timeout: 15_000 });
  const link = rows.getByRole("link");
  const isEmpty = (await link.count()) === 0;
  if (isEmpty) {
    await expect(rows).toContainText("Nothing landed in this category this month.");
  } else {
    await expect(link.first()).toBeVisible();
  }

  expect(await tooWideInside(page, "main")).toEqual([]);
});

test("the settlement rows stack and keep every column as a labelled pair", async ({ page }) => {
  await openPhone(page, `/finance/settlement?month=${partnerHeavyMonth()}`);
  const rows = region(page, "Shared rows in this period");
  await expect(rows).toBeVisible({ timeout: 15_000 });

  await expect(rows.getByRole("link").first()).toBeVisible();
  for (const label of ["Paid by", "Full", "Mine", "Your share"]) {
    await expect(rows.getByText(label, { exact: true }).first()).toBeVisible();
  }
  await expect(rows.getByText(/\d+ rows? counted/)).toBeVisible();

  expect(await tooWideInside(page, '[aria-label="Shared rows in this period"]')).toEqual([]);
});

test("the filter chips still narrow the stacked list, empty state included", async ({ page }) => {
  await openPhone(page, `/finance/settlement?month=${partnerHeavyMonth()}`);
  const rows = region(page, "Shared rows in this period");
  await expect(rows).toBeVisible({ timeout: 15_000 });

  for (const label of ["You paid", "Partner paid", "Missing split"]) {
    await expect(rows.getByRole("button", { name: label })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  }

  await rows.getByRole("button", { name: "Partner paid" }).click();
  await expect(rows.getByRole("button", { name: "Partner paid" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(rows.getByText("You", { exact: true })).toHaveCount(0);

  // No seeded row carries an unresolved flag in this period, so the empty state is this filter's
  // happy path rather than an edge case.
  await rows.getByRole("button", { name: "Missing split" }).click();
  await expect(rows).toContainText("No row in this period matches that filter.");
});

test("the settled-periods history stacks and still links each period", async ({ page }) => {
  await openPhone(page, `/finance/settlement?month=${partnerHeavyMonth()}`);
  const history = region(page, "Settled periods");
  await expect(history).toBeVisible({ timeout: 15_000 });

  const link = history.getByRole("link").first();
  await expect(link).toHaveAttribute("href", /\/finance\/settlement\?month=\d{4}-\d{2}/);

  expect(await tooWideInside(page, '[aria-label="Settled periods"]')).toEqual([]);
});

test("the import preview stacks, and the lens buttons still switch the list", async ({ page }) => {
  await openPhone(page, "/finance/import");
  await expect(page.getByRole("heading", { name: "Import", exact: true })).toBeVisible({
    timeout: 15_000,
  });

  const fileInput = page.locator('input[type="file"]');
  await expect(fileInput).toHaveCount(1);
  await fileInput.setInputFiles({
    name: "e2e-phone-statement.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(STATEMENT),
  });

  await expect(page.getByRole("heading", { name: "What will happen" })).toBeVisible();
  await expect(page.getByText("E2E PHONE COFFEE")).toBeVisible();

  await page.getByTestId("import-count-already-here").click();
  await expect(page.getByText("No rows read this way.")).toBeVisible();
  await page.getByTestId("import-count-will-add").click();
  await expect(page.getByText("E2E PHONE COFFEE")).toBeVisible();

  expect(await tooWideInside(page, "main")).toEqual([]);
});

test("the view strip fades where it is cut and hides the fade at the end", async ({ page }) => {
  await openPhone(page, "/finance");
  const strip = page.locator('nav[aria-label="Finance views"]');
  await expect(strip).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("finance-nav-fade")).toBeVisible();

  await strip.evaluate((node) => node.scrollTo({ left: node.scrollWidth }));
  await expect(page.getByTestId("finance-nav-fade")).toHaveCount(0);
});

test("landing on the last room scrolls its pill back into the strip", async ({ page }) => {
  await openPhone(page, "/finance/import");
  const strip = page.locator('nav[aria-label="Finance views"]');
  await expect(strip).toBeVisible({ timeout: 15_000 });

  const pressed = strip.locator('[aria-pressed="true"]');
  await expect(pressed).toHaveText(/Import/);

  const stripBox = await strip.boundingBox();
  const pillBox = await pressed.boundingBox();
  if (stripBox === null || pillBox === null) throw new Error("the strip or its pill has no box");
  expect(pillBox.x, "the pressed pill starts left of the strip").toBeGreaterThanOrEqual(
    stripBox.x - 1,
  );
  expect(
    pillBox.x + pillBox.width,
    "the pressed pill runs past the strip's right edge",
  ).toBeLessThanOrEqual(stripBox.x + stripBox.width + 1);
});

test("every account control on a phone is a target a thumb can hit", async ({ page }) => {
  await openPhone(page, "/finance/import");
  await expect(page.getByRole("heading", { name: "Import", exact: true })).toBeVisible({
    timeout: 15_000,
  });

  const newAccount = page
    .getByTestId("finance-accounts-card")
    .getByRole("button", { name: "New account" });
  await expectThumbSized(newAccount, "New account");

  await newAccount.click();
  await expectThumbSized(page.getByRole("button", { name: "Cancel" }), "Cancel");
  await expectThumbSized(page.getByRole("button", { name: "Create account" }), "Create account");
  await page.getByRole("button", { name: "Cancel" }).click();

  await clearFinanceStores(page, ["financeAccounts", "financeTransactions"]);
  await page.goto("/finance", { waitUntil: "networkidle" });
  await expect(page.getByText("Set up your first account")).toBeVisible({ timeout: 15_000 });
  await expectThumbSized(page.getByRole("button", { name: "Add an account" }), "Add an account");
});
