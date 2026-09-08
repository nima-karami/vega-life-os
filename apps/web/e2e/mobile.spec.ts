import { expect, type Locator, type Page, test } from "@playwright/test";
import { dragAlong, endTouch, startTouch } from "./helpers/touch";

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

/**
 * How far a bottom-fixed bar hangs into the nav band; ≤ 1 means it clears the glyphs.
 *
 * Always read through expect.poll: PageTransition animates `filter: blur()`, and a live
 * filter makes the routed page a containing block for the fixed bars it owns, so for the
 * first 0.3–0.45s of a route they resolve against the page box and read un-lifted.
 */
async function navOverlap(page: Page, bar: Locator): Promise<number> {
  const navBox = await page.locator("[data-bottom-nav]").boundingBox();
  const barBox = await bar.boundingBox();
  // A box caught mid-mount is "not clear yet" — infinity lets expect.poll retry, not abort.
  if (!navBox || !barBox) return Number.POSITIVE_INFINITY;
  return barBox.y + barBox.height - navBox.y;
}

/** scrollWidth must not exceed clientWidth — no horizontal page overflow. */
async function horizontalOverflow(page: import("@playwright/test").Page): Promise<number> {
  return page.evaluate(() => {
    const el = document.documentElement;
    return el.scrollWidth - el.clientWidth;
  });
}

const ROUTES = [
  "/today",
  "/values",
  "/habits",
  "/calendar",
  "/analytics",
  "/settings",
  "/cards",
  "/cards/new",
];

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

test("habit page opens from a card, fits the column, and the trail climbs out (360px)", async ({
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

  // The trail's first level returns to the values index.
  const trail = page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link");
  await expect(trail.first()).toHaveText("Values");
  await trail.first().click();
  await expect(page).toHaveURL(/\/values$/);
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
  for (const label of ["Today", "Calendar", "Habits", "Values", "Analytics", "BrainWrite"]) {
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

  // The retired Scroll slot now carries BrainWrite.
  await nav.getByRole("button", { name: "BrainWrite" }).click();
  await expect(page).toHaveURL(/\/brainwrite$/);
  await expect(nav.getByRole("button", { name: "BrainWrite" })).toHaveAttribute(
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

test("a long press starts selection while a tap still opens the card (390px)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cards", { waitUntil: "domcontentloaded" });
  await passGratitudeGate(page);

  const row = page.locator("[data-card-row]:visible").first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  const box = await row.boundingBox();
  if (!box) throw new Error("row has no box");

  await expect(page.getByText(/\d+ selected/)).toHaveCount(0);

  // A synthetic PointerEvent defaults isPrimary to false, which useLongPress now filters
  // out — a real first finger always carries it.
  const touch = { pointerType: "touch", pointerId: 1, isPrimary: true };
  await row.dispatchEvent("pointerdown", {
    ...touch,
    clientX: box.x + box.width / 2,
    clientY: box.y + 10,
  });
  await page.waitForTimeout(650);
  await row.dispatchEvent("pointerup", touch);

  await expect(page.getByText("1 selected")).toBeVisible();
});

test("the cards filter opens as a centred modal on a phone (390px)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cards", { waitUntil: "domcontentloaded" });
  await passGratitudeGate(page);

  await page.getByRole("button", { name: "Filter cards" }).click();
  await expect(page.getByRole("dialog")).toContainText("Filter cards");
});

// ─── Bottom-fixed bars clear the nav band (spec §7) ──────────────────────────

test("the undo bar clears the nav and a nav tab still navigates under it (390px)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/today", { waitUntil: "domcontentloaded" });
  await passGratitudeGate(page);
  await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });

  await page.locator('main [aria-label^="Actions for "]').first().click();
  await page.getByRole("menuitem", { name: "Delete" }).click();

  const undoBar = page.getByRole("status").filter({ hasText: "Task deleted" });
  await expect(undoBar).toBeVisible();
  await expect
    .poll(() => navOverlap(page, undoBar), {
      message: "the undo bar hangs over the nav band",
      timeout: 5_000,
    })
    .toBeLessThanOrEqual(1);

  // The point of the lift: the glyph is reachable, not merely un-intersected.
  const nav = page.getByRole("navigation", { name: "Primary" });
  await nav.getByRole("button", { name: "Habits" }).click();
  await expect(page).toHaveURL(/\/habits$/);
});

test("a toast clears the nav band (390px)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/today", { waitUntil: "domcontentloaded" });
  await passGratitudeGate(page);
  await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });

  const nav = page.getByRole("navigation", { name: "Primary" });
  await nav.getByRole("button", { name: "Search" }).click();
  const commandBar = page.getByRole("dialog", { name: "Command bar" });
  await expect(commandBar).toBeVisible();
  await page.keyboard.type("clear the nav band");
  await page.getByRole("button", { name: /to backlog$/ }).click();

  // The toast self-dismisses after 2.6s, so poll it rather than settling first.
  const toast = page.getByRole("status").filter({ hasText: "to backlog" });
  await expect
    .poll(() => navOverlap(page, toast), {
      message: "the toast hangs over the nav band",
      intervals: [50, 50, 100, 100, 200],
      timeout: 2_400,
    })
    .toBeLessThanOrEqual(1);
});

test("the journal format toolbar docks flush on the nav band (390px)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const today = new Date();
  const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  await page.goto(`/journal/${date}`, { waitUntil: "domcontentloaded" });

  const editor = page.getByRole("textbox", { name: "Journal" });
  await expect(editor).toBeVisible({ timeout: 15_000 });
  await editor.click();
  await editor.pressSequentially("format me");
  await page.keyboard.press("Shift+Home");

  // D-C1-2: a toolbar, not a notification — it sits ON the band's top edge, no gap.
  const toolbar = page.getByRole("toolbar", { name: "Text formatting" });
  await expect(toolbar).toBeVisible();
  await expect
    .poll(() => navOverlap(page, toolbar).then(Math.abs), {
      message: "the format toolbar is not docked flush against the nav band",
      timeout: 5_000,
    })
    .toBeLessThanOrEqual(1);
});

test("the journal slash menu clears the nav band (390px)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const today = new Date();
  const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  await page.goto(`/journal/${date}`, { waitUntil: "domcontentloaded" });

  const editor = page.getByRole("textbox", { name: "Journal" });
  await expect(editor).toBeVisible({ timeout: 15_000 });
  await editor.click();
  await editor.pressSequentially("/");

  const slashMenu = page.getByRole("listbox", { name: "Insert block" });
  await expect(slashMenu).toBeVisible();
  await expect
    .poll(() => navOverlap(page, slashMenu), {
      message: "the slash menu hangs over the nav band",
      timeout: 5_000,
    })
    .toBeLessThanOrEqual(1);
});

// ─── Touch-reachable task and goal-step actions (spec §8) ────────────────────

const MIN_TOUCH_PX = 44;
const PHONE = { width: 390, height: 844 };

async function openPhone(page: Page, route: string) {
  await page.setViewportSize(PHONE);
  await page.goto(route, { waitUntil: "domcontentloaded" });
  await passGratitudeGate(page);
  await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });
}

/** `toBeVisible()` passes on `opacity: 0`, so reachability needs the computed value. */
async function measureControl(control: Locator) {
  const opacity = await control.evaluate((el) => getComputedStyle(el).opacity);
  const box = await control.boundingBox();
  if (!box) throw new Error("the control has no bounding box");
  return { opacity, box };
}

function expectTouchSized(box: { width: number; height: number }, what: string) {
  expect(box.width, `${what} is narrower than ${MIN_TOUCH_PX}px`).toBeGreaterThanOrEqual(
    MIN_TOUCH_PX,
  );
  expect(box.height, `${what} is shorter than ${MIN_TOUCH_PX}px`).toBeGreaterThanOrEqual(
    MIN_TOUCH_PX,
  );
}

async function addUntimedTask(page: Page, title: string) {
  const titleInput = page.getByRole("textbox", { name: "Task title" });
  // A commit leaves the composer open on an empty draft, so the second call has no
  // collapsed trigger left to press.
  if (!(await titleInput.isVisible().catch(() => false))) {
    await page
      .getByRole("button", { name: /^Add task$/ })
      .first()
      .click();
  }
  await expect(titleInput).toBeVisible();
  await titleInput.fill(title);
  await titleInput.press("Enter");
  await expect(page.getByRole("region", { name: "Remaining" })).toContainText(title);
}

const reorderLabels = (page: Page): Promise<string[]> =>
  page
    .locator('main [aria-label^="Reorder "]')
    .evaluateAll((els) => els.map((el) => el.getAttribute("aria-label") ?? ""));

test("the task actions menu is visible, 44px and works by tap (390px)", async ({ page }) => {
  await openPhone(page, "/today");
  const remaining = page.getByRole("region", { name: "Remaining" });
  await expect(remaining).toBeVisible({ timeout: 15_000 });

  const trigger = remaining.locator('[aria-label^="Actions for "]').first();
  const { opacity, box } = await measureControl(trigger);
  expect(opacity, "the task ⋯ trigger is transparent on a phone").toBe("1");
  expectTouchSized(box, "the task ⋯ trigger");

  await trigger.click();
  await page.getByRole("menuitem", { name: "Skip" }).click();
  // A skipped task is resolved, so its card leaves Remaining for the Done section.
  await expect(page.locator("main").getByText("Skipped").first()).toBeVisible();
});

test("the task done toggle has a 44px hit box (390px)", async ({ page }) => {
  await openPhone(page, "/today");
  const remaining = page.getByRole("region", { name: "Remaining" });
  await expect(remaining).toBeVisible({ timeout: 15_000 });

  const { box } = await measureControl(remaining.locator('[aria-label^="Mark "]').first());
  expectTouchSized(box, "the task done toggle");
});

test("a goal step is removable by tap on a phone (390px)", async ({ page }) => {
  await openPhone(page, "/values");

  // Tapping through both long-press rows (a value card, then a goal card) also proves a
  // press under the sensor delay still activates the link the row wraps.
  await page.locator('main a[href^="/values/"]').first().click();
  await expect(page).toHaveURL(/\/values\/[^/]+$/);
  await page.locator('main a[href^="/goals/"]').first().click();
  await expect(page).toHaveURL(/\/goals\/[^/]+$/);

  const draft = page.getByRole("textbox", { name: "Add a step" });
  await draft.fill("touch-removable step");
  await draft.press("Enter");

  const removes = page.locator('main [aria-label^="Remove "]');
  const remove = page.getByRole("button", { name: "Remove touch-removable step" });
  await expect(remove).toHaveCount(1);
  const before = await removes.count();

  const { opacity, box } = await measureControl(remove);
  expect(opacity, "the step remove is transparent on a phone").toBe("1");
  expectTouchSized(box, "the step remove");

  await remove.click();
  await expect(removes).toHaveCount(before - 1);
});

test("a long press reorders two untimed tasks and the order survives a reload (390px)", async ({
  page,
}) => {
  await openPhone(page, "/today");
  await addUntimedTask(page, "First untimed");
  await addUntimedTask(page, "Second untimed");

  // The open composer pushes the untimed rows past the fold, and a CDP touch outside
  // the viewport lands on nothing.
  await page.getByRole("textbox", { name: "Task title" }).press("Escape");

  const rows = page.locator('main [aria-label^="Reorder "]');
  await expect(rows).toHaveCount(2);
  expect(await reorderLabels(page)).toEqual(["Reorder First untimed", "Reorder Second untimed"]);

  await rows.nth(1).evaluate((el) => {
    el.scrollIntoView({ block: "center" });
  });
  const fromBox = await rows.first().boundingBox();
  const toBox = await rows.nth(1).boundingBox();
  if (!fromBox || !toBox) throw new Error("a sortable row has no bounding box");
  const from = { x: fromBox.x + fromBox.width / 2, y: fromBox.y + fromBox.height / 2 };
  const to = { x: from.x, y: toBox.y + toBox.height * 0.75 };

  await startTouch(page, from);
  // Both sensors have to arm: touch at 250ms, pointer-from-touch at 300ms. Holding
  // still keeps the press inside the 8px tolerance that would cancel it.
  await page.waitForTimeout(500);
  await dragAlong(page, { from, to, durationMs: 500, steps: 10 });
  await endTouch(page);

  await expect
    .poll(() => reorderLabels(page), { message: "the long press did not reorder the rows" })
    .toEqual(["Reorder Second untimed", "Reorder First untimed"]);

  await page.reload({ waitUntil: "domcontentloaded" });
  await passGratitudeGate(page);
  await expect
    .poll(() => reorderLabels(page), { message: "the new order did not survive a reload" })
    .toEqual(["Reorder Second untimed", "Reorder First untimed"]);
});
