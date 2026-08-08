import { expect, test } from "@playwright/test";

/**
 * Mobile-usability proof (spec §7). Runs on a touch phone profile; the @automatable
 * scenarios drive several portrait widths. Touch-drag feel, on-screen-keyboard
 * avoidance, and OS safe-area insets are manual on-device smoke — not asserted here.
 */

const IGNORE = [/Download the React DevTools/i, /\[vite\]/i, /Firebase/i];

const WIDTHS = [320, 360, 390, 430];

async function bootSandbox(page: import("@playwright/test").Page) {
  // domcontentloaded (not networkidle) — networkidle is flaky under the full
  // suite's parallel load + the eager editor chunk + SW; the explicit element
  // waits below are the real synchronization.
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const explore = page.getByRole("button", { name: /explore with sample data/i });
  const omni = page.getByTestId("omni-trigger");
  const main = page.locator("main");
  await expect(explore.or(omni).or(main)).toBeVisible({ timeout: 20_000 });
  if (await explore.isVisible().catch(() => false)) {
    await explore.click();
    await expect(main).toBeVisible({ timeout: 15_000 });
  }
}

async function passGratitudeGate(page: import("@playwright/test").Page) {
  const gate = page.getByRole("button", { name: "Continue to today" });
  if (await gate.isVisible().catch(() => false)) {
    await page.getByRole("textbox", { name: "Grateful for, item 1" }).fill("e2e gratitude");
    await gate.click();
  }
}

/** scrollWidth must not exceed clientWidth — no horizontal page overflow. */
async function horizontalOverflow(page: import("@playwright/test").Page): Promise<number> {
  return page.evaluate(() => {
    const el = document.documentElement;
    return el.scrollWidth - el.clientWidth;
  });
}

const ROUTES = ["/today", "/values", "/habits", "/calendar", "/analytics", "/settings"];

test.beforeEach(async ({ page }) => {
  await bootSandbox(page);
  await passGratitudeGate(page);
});

for (const width of WIDTHS) {
  for (const route of ROUTES) {
    test(`no horizontal overflow at ${width}px on ${route}`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
      page.on("console", (m) => {
        if (m.type() === "error" && !IGNORE.some((re) => re.test(m.text()))) {
          errors.push(`console.error: ${m.text()}`);
        }
      });

      await page.setViewportSize({ width, height: 780 });
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await passGratitudeGate(page);
      await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });

      // Poll the settled layout: v3 hydration can briefly overflow for <1 frame
      // before responsive sizing lands; the requirement is the settled page.
      await expect
        .poll(() => horizontalOverflow(page), {
          message: `page overflows horizontally at ${width}px on ${route}`,
          timeout: 5_000,
        })
        .toBeLessThanOrEqual(1);

      expect(errors, `runtime errors on ${route}:\n${errors.join("\n")}`).toEqual([]);
    });
  }
}

test("phone bottom nav exposes search and account controls (360px)", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/today", { waitUntil: "domcontentloaded" });
  await passGratitudeGate(page);
  await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });

  // Search + account live in the bottom nav on phones (no top header).
  const nav = page.getByRole("navigation", { name: "Primary" });
  const search = nav.getByRole("button", { name: "Search" });
  const account = nav.getByRole("button", { name: "Account menu" });
  await expect(search).toBeVisible();
  await expect(account).toBeVisible();

  // Search opens the command bar; Escape closes it.
  await search.click();
  await expect(page.getByRole("dialog", { name: "Command bar" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Command bar" })).toHaveCount(0);

  // Account opens its menu.
  await account.click();
  await expect(page.getByRole("menu", { name: "Account" })).toBeVisible();
});

test("habit page opens from a card, fits the column, and the back link returns (360px)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 720 });
  await page.goto("/habits", { waitUntil: "domcontentloaded" });
  await passGratitudeGate(page);
  await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });

  await page.locator('main a[href^="/habits/"]').first().click();
  const name = page.getByRole("textbox", { name: "Habit name" });
  await expect(name).toBeVisible({ timeout: 15_000 });

  // Nothing hangs off the side of a 360px column.
  const box = await page.locator("main").boundingBox();
  if (!box) throw new Error("main has no bounds");
  expect(box.x).toBeGreaterThanOrEqual(-1);
  expect(box.width).toBeLessThanOrEqual(361);

  // The schedule controls sit far down the page and scroll into reach.
  const anytime = page.getByRole("button", { name: "Anytime", exact: true });
  await anytime.scrollIntoViewIfNeeded();
  await expect(anytime).toBeVisible();

  // The back link returns to the index.
  await page.getByRole("link", { name: "Habits", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Habits", exact: true })).toBeVisible();
});

test("phone bottom nav shows the primary tabs and navigates between routes (390px)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 780 });
  await page.goto("/today", { waitUntil: "domcontentloaded" });
  await passGratitudeGate(page);
  await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });

  const nav = page.getByRole("navigation", { name: "Primary" });
  await expect(nav).toBeVisible();
  for (const label of ["Today", "Calendar", "Habits", "Values", "Analytics", "Scroll"]) {
    await expect(nav.getByRole("button", { name: label })).toBeVisible();
  }

  // Tapping a tab navigates and marks it the current page.
  await nav.getByRole("button", { name: "Habits" }).click();
  await expect(page).toHaveURL(/\/habits$/);
  await expect(nav.getByRole("button", { name: "Habits" })).toHaveAttribute("aria-current", "page");

  await nav.getByRole("button", { name: "Calendar" }).click();
  await expect(page).toHaveURL(/\/calendar$/);
  await expect(nav.getByRole("button", { name: "Calendar" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("calendar shows a single-day view with day navigation and no page overflow (390px)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 780 });
  await page.goto("/calendar", { waitUntil: "domcontentloaded" });
  await passGratitudeGate(page);
  await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });

  // Single-day nav controls (per-day, not per-week).
  await expect(page.getByRole("button", { name: "Previous day" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Next day" })).toBeVisible();

  // Page body does not scroll sideways (the grid scrolls inside its own region).
  const overflow = await horizontalOverflow(page);
  expect(overflow, `calendar page overflows by ${overflow}px`).toBeLessThanOrEqual(1);
});

test("analytics charts do not overflow horizontally on mobile (360px)", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/analytics", { waitUntil: "domcontentloaded" });
  await passGratitudeGate(page);
  await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });

  // Default window must not overflow horizontally.
  const defaultOverflow = await horizontalOverflow(page);
  expect(
    defaultOverflow,
    `analytics (default) overflows by ${defaultOverflow}px`,
  ).toBeLessThanOrEqual(1);

  // The 90-day window renders the wide consistency heatmap; it must stay scroll-contained
  // so the page still never overflows.
  await page.getByRole("button", { name: "90 days" }).click();
  await expect(page.locator("main")).toBeVisible();
  const wideOverflow = await horizontalOverflow(page);
  expect(
    wideOverflow,
    `analytics (90d, heatmap) overflows by ${wideOverflow}px`,
  ).toBeLessThanOrEqual(1);
});

test("calendar: long-press an all-day chip → 'Move to day…' moves it to another day", async ({
  page,
}) => {
  await page.goto("/calendar", { waitUntil: "domcontentloaded" });
  await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });

  // Compact shows one day; the seeded all-day one-off is on Tuesday.
  await page.getByRole("button", { name: /^Tue\s*\d{2}$/ }).click();
  const chip = page.getByRole("button", { name: "Pick up dry cleaning, all day" });
  await expect(chip).toBeVisible({ timeout: 10_000 });

  const box = await chip.boundingBox();
  const touch = {
    pointerType: "touch",
    pointerId: 1,
    isPrimary: true,
    button: 0,
    buttons: 1,
    bubbles: true,
    cancelable: true,
    composed: true,
    clientX: (box?.x ?? 0) + 8,
    clientY: (box?.y ?? 0) + 8,
  };
  await chip.dispatchEvent("pointerdown", touch);
  const moveItem = page.getByRole("menuitem", { name: "Move to day…" });
  await expect(moveItem).toBeVisible({ timeout: 5_000 });
  await chip.dispatchEvent("pointerup", { ...touch, buttons: 0 });

  await moveItem.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Move to a day", { timeout: 10_000 });
  await dialog.getByRole("button", { name: /^Wed, / }).click();

  // It left Tuesday (the only rendered day) and is untimed on Wednesday.
  await expect(page.getByRole("button", { name: "Pick up dry cleaning, all day" })).toHaveCount(0);
  await page.getByRole("button", { name: /^Wed\s*\d{2}$/ }).click();
  await expect(page.getByRole("button", { name: "Pick up dry cleaning, all day" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^Pick up dry cleaning, \d{2}:\d{2}/ }),
  ).toHaveCount(0);
});
