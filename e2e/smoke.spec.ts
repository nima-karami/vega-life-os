import { expect, test } from "@playwright/test";

/**
 * Smoke suite for the vapor redesign shell (slice 0).
 *
 * Asserts:
 * 1. App boots to /today — NO TopBar, NO NavRow in DOM
 * 2. Omni trigger is visible on /today
 * 3. All 5 v1 routes render real content with no uncaught errors
 * 4. A removed route (e.g. /board) renders the 404 recovery page
 */

// Known-benign console noise we don't want to fail the smoke on.
const IGNORE = [
  /Download the React DevTools/i,
  /\[vite\]/i,
  /Firebase/i, // cloud sync is gated off without config — expected
];

// Boot the app and dismiss onboarding once before each test.
test.beforeEach(async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });

  // The app settles into EITHER onboarding or the booted shell.
  const explore = page.getByRole("button", { name: /explore with sample data/i });
  const omni = page.getByTestId("omni-trigger");
  const main = page.locator("main");

  await expect(explore.or(omni).or(main)).toBeVisible({ timeout: 20_000 });

  if (await explore.isVisible()) {
    await explore.click();
    // Wait until onboarding is gone and the main content area appears
    await expect(main).toBeVisible({ timeout: 15_000 });
  }
});

test("boots to /today — no TopBar, no NavRow, omni trigger visible", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !IGNORE.some((re) => re.test(m.text()))) {
      errors.push(`console.error: ${m.text()}`);
    }
  });

  await page.goto("/", { waitUntil: "networkidle" });

  // No legacy nav chrome
  await expect(page.locator("header")).toHaveCount(0);
  await expect(page.locator("nav")).toHaveCount(0);

  // Omni trigger present
  await expect(page.getByTestId("omni-trigger")).toBeVisible({ timeout: 10_000 });

  // Content in main
  const text = (await page.locator("main").innerText()).trim();
  expect(text.length, "main content too short").toBeGreaterThan(20);

  expect(errors, `runtime errors:\n${errors.join("\n")}`).toEqual([]);
});

const V1_ROUTES: { path: string; name: string }[] = [
  { path: "/today", name: "today" },
  { path: "/values", name: "values-goals" },
  { path: "/habits", name: "habits" },
  { path: "/calendar", name: "calendar" },
  { path: "/analytics", name: "analytics" },
];

for (const { path, name } of V1_ROUTES) {
  test(`renders ${name} (${path}) with content and no errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error" && !IGNORE.some((re) => re.test(m.text()))) {
        errors.push(`console.error: ${m.text()}`);
      }
    });

    await page.goto(path, { waitUntil: "networkidle" });

    // main content area is present
    const main = page.locator("main");
    await expect(main).toBeVisible({ timeout: 15_000 });

    // Real content rendered (not blank)
    const text = (await main.innerText()).trim();
    expect(text.length, `view "${name}" rendered too little text`).toBeGreaterThan(40);

    // No legacy nav chrome
    await expect(page.locator("header")).toHaveCount(0);
    await expect(page.locator("nav")).toHaveCount(0);

    expect(errors, `runtime errors on ${name}:\n${errors.join("\n")}`).toEqual([]);
  });
}

const REMOVED_ROUTES = ["/board", "/map", "/library", "/lab", "/cockpit", "/review"];

for (const path of REMOVED_ROUTES) {
  test(`removed route ${path} shows 404 recovery`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error" && !IGNORE.some((re) => re.test(m.text()))) {
        errors.push(`console.error: ${m.text()}`);
      }
    });

    await page.goto(path, { waitUntil: "networkidle" });

    // 404 page shows — wait for main to contain recovery text
    const main = page.locator("main");
    await expect(main).toBeVisible({ timeout: 15_000 });

    // Recovery link exists
    const goToToday = page.getByRole("link", { name: /go to today/i });
    await expect(goToToday).toBeVisible({ timeout: 10_000 });

    expect(errors, `runtime errors on 404 for ${path}:\n${errors.join("\n")}`).toEqual([]);
  });
}

// ─── Slice 1: Today view ─────────────────────────────────────────────────────

test("today header shows date and an X of Y done progress read-out", async ({ page }) => {
  await page.goto("/today", { waitUntil: "networkidle" });
  const main = page.locator("main");
  await expect(main).toBeVisible({ timeout: 15_000 });
  // Heading + progress copy ("N of M done" or the empty-state copy).
  await expect(page.getByRole("heading", { name: "Today", exact: true })).toBeVisible();
  await expect(main).toContainText(/(\d+ of \d+ done|Nothing scheduled)/);
});

test("completing a remaining task moves it to Done and updates progress", async ({ page }) => {
  await page.goto("/today", { waitUntil: "networkidle" });
  const remaining = page.getByRole("region", { name: "Remaining" });
  await expect(remaining).toBeVisible({ timeout: 15_000 });

  // Grab the first "Mark … done" control in the Remaining group.
  const firstComplete = remaining.getByRole("button", { name: /^Mark .+ done$/ }).first();
  await expect(firstComplete).toBeVisible();
  // Derive the task title from the aria-label so we can assert it lands in Done.
  const label = (await firstComplete.getAttribute("aria-label")) ?? "";
  const title = label.replace(/^Mark /, "").replace(/ done$/, "");

  await firstComplete.click();

  // The Done group now exists and contains that task.
  const doneGroup = page.getByRole("region", { name: "Done" });
  await expect(doneGroup).toBeVisible();
  await expect(doneGroup).toContainText(title);

  // Reload — the change persisted.
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("region", { name: "Done" })).toContainText(title);
});

test("add-a-task captures a title and the card appears in Remaining", async ({ page }) => {
  await page.goto("/today", { waitUntil: "networkidle" });
  await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });

  // Expand the inline capture and type a title.
  await page
    .getByRole("button", { name: /^Add a task$/ })
    .first()
    .click();
  const titleInput = page.getByRole("textbox", { name: "Task title" });
  await expect(titleInput).toBeFocused();
  const unique = `E2E task ${Date.now()}`;
  await titleInput.fill(unique);
  await titleInput.press("Enter");

  // The new card shows up in Remaining.
  const remaining = page.getByRole("region", { name: "Remaining" });
  await expect(remaining).toContainText(unique);
});
