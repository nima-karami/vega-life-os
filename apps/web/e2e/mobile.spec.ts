import { expect, type Locator, type Page, test } from "@playwright/test";
import { skipGratitudePage, turnQuietModeOff } from "./helpers/app";
import { expectMenuClearOf, expectMenuOpenAndInert } from "./helpers/menu";
import { dragAlong, endTouch, longPress, startTouch, swipe, tap } from "./helpers/touch";

/**
 * Mobile-usability proof (spec §7). Runs on a touch phone profile; the @automatable
 * scenarios drive several portrait widths. Touch-drag feel, on-screen-keyboard
 * avoidance, and OS safe-area insets are manual on-device smoke — not asserted here.
 */

const IGNORE = [/Download the React DevTools/i, /\[vite\]/i, /Firebase/i];

const WIDTHS = [320, 360, 390, 430];

async function bootSandbox(page: import("@playwright/test").Page) {
  await skipGratitudePage(page);
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

/**
 * Always read through expect.poll: PageTransition animates `filter: blur()`, and a live
 * filter makes the routed page a containing block for the fixed bars it owns, so for the
 * first 0.3–0.45s of a route they resolve against the page box and read un-lifted.
 */
async function navOverlap(page: Page, bar: Locator): Promise<number> {
  const navBox = await page.locator("[data-bottom-nav]").boundingBox();
  const barBox = await bar.boundingBox();
  // Infinity keeps a box caught mid-mount inside expect.poll's retry rather than aborting.
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

/**
 * `main` is `overflow-x-hidden`, so content pushed past the right edge never reaches
 * `documentElement.scrollWidth` — it is silently clipped and unreachable. Measure the
 * boxes themselves instead; anything inside a real scroller is reachable by a finger,
 * and a `truncate` box reports its clipped border box, so neither is a false positive.
 * Returns "" when clean, else a description of the worst offender.
 */
async function measureClippedOverflow(page: Page): Promise<string> {
  return page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const main = document.querySelector("main");
    if (!main) return "";
    const isInsideScroller = (el: Element) => {
      for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
        const overflowX = getComputedStyle(p).overflowX;
        if (overflowX === "auto" || overflowX === "scroll") return true;
      }
      return false;
    };
    let worst = 1;
    let culprit = "";
    for (const el of main.querySelectorAll("*")) {
      const rect = el.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) continue;
      const past = Math.round(rect.right - viewportWidth);
      if (past <= worst || isInsideScroller(el)) continue;
      worst = past;
      culprit = `${el.tagName.toLowerCase()}.${(el.getAttribute("class") ?? "").slice(0, 60)}`;
    }
    return culprit && `${worst}px past the viewport: ${culprit}`;
  });
}

/** Derived, never pinned — a literal date in a fixture rots the day it passes. */
function todayISO(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${String(now.getDate()).padStart(2, "0")}`;
}

const TODAY = todayISO();

const ROUTES = [
  "/today",
  "/values",
  "/habits",
  "/calendar",
  "/analytics",
  "/analytics?tab=review",
  "/settings",
  "/cards",
  "/cards/new",
  "/entries",
  `/journal/${TODAY}`,
  "/finance",
  "/finance/transactions",
  "/finance/categories",
  "/finance/settlement",
  "/finance/import",
];

/** Detail routes carry runtime ids, so each is reached by following the index's first link. */
const DETAIL_TRAILS: { name: string; steps: { from?: string; link: string }[] }[] = [
  { name: "/values/:id", steps: [{ from: "/values", link: 'main a[href^="/values/"]' }] },
  {
    name: "/goals/:id",
    steps: [
      { from: "/values", link: 'main a[href^="/values/"]' },
      { link: 'main a[href^="/goals/"]' },
    ],
  },
  { name: "/habits/:id", steps: [{ from: "/habits", link: 'main a[href^="/habits/"]' }] },
];

test.beforeEach(async ({ page }) => {
  await bootSandbox(page);
});

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !IGNORE.some((re) => re.test(m.text()))) {
      errors.push(`console.error: ${m.text()}`);
    }
  });
  return errors;
}

async function expectNoOverflow(page: Page, where: string) {
  // Poll the settled layout: v3 hydration can briefly overflow for <1 frame
  // before responsive sizing lands; the requirement is the settled page.
  await expect
    .poll(() => horizontalOverflow(page), {
      message: `page overflows horizontally on ${where}`,
      timeout: 5_000,
    })
    .toBeLessThanOrEqual(1);

  await expect
    .poll(() => measureClippedOverflow(page), {
      message: `content is clipped off the right edge on ${where}`,
      timeout: 5_000,
    })
    .toBe("");
}

for (const width of WIDTHS) {
  for (const route of ROUTES) {
    test(`no horizontal overflow at ${width}px on ${route}`, async ({ page }) => {
      const errors = watchErrors(page);

      await page.setViewportSize({ width, height: 780 });
      const evening = new Date();
      evening.setHours(19, 0, 0, 0);
      if (route.startsWith("/analytics")) await turnQuietModeOff(page);
      await page.clock.install({ time: evening });
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });

      await expectNoOverflow(page, `${route} at ${width}px`);

      expect(errors, `runtime errors on ${route}:\n${errors.join("\n")}`).toEqual([]);
    });
  }
}

for (const width of WIDTHS) {
  for (const trail of DETAIL_TRAILS) {
    test(`no horizontal overflow at ${width}px on ${trail.name}`, async ({ page }) => {
      const errors = watchErrors(page);

      await page.setViewportSize({ width, height: 780 });
      for (const step of trail.steps) {
        if (step.from) {
          await page.goto(step.from, { waitUntil: "domcontentloaded" });
        }
        await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });
        await page.locator(step.link).first().click();
      }
      await expect(page).toHaveURL(/\/[^/]+\/[^/]+$/, { timeout: 15_000 });

      await expectNoOverflow(page, `${trail.name} at ${width}px`);

      expect(errors, `runtime errors on ${trail.name}:\n${errors.join("\n")}`).toEqual([]);
    });
  }
}

test("phone bottom nav exposes search and account controls (360px)", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/today", { waitUntil: "domcontentloaded" });
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
  await turnQuietModeOff(page);
  await page.setViewportSize({ width: 390, height: 780 });
  await page.goto("/today", { waitUntil: "domcontentloaded" });
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
  await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });

  // Single-day nav controls (per-day, not per-week).
  await expect(page.getByRole("button", { name: "Previous day" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Next day" })).toBeVisible();

  // Page body does not scroll sideways (the grid scrolls inside its own region).
  const overflow = await horizontalOverflow(page);
  expect(overflow, `calendar page overflows by ${overflow}px`).toBeLessThanOrEqual(1);
});

test("analytics charts do not overflow horizontally on mobile (360px)", async ({ page }) => {
  await turnQuietModeOff(page);
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/analytics", { waitUntil: "domcontentloaded" });
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

const ALL_DAY_CHIP = "Pick up dry cleaning, all day";

async function centreOf(chip: Locator) {
  const box = await chip.boundingBox();
  if (box === null) throw new Error("the all-day chip has no bounding box");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** The first hold arms and opens nothing; the menu is a second gesture on the armed chip. */
async function armAllDayChip(page: Page, chip: Locator) {
  const centre = await centreOf(chip);
  await longPress(page, centre);
  await expect(page.locator('[data-armed="true"]')).toHaveCount(1);
  await expect(page.getByRole("menu")).toHaveCount(0);
  return centre;
}

test("calendar: long-press an all-day chip → 'Move to day…' moves it to another day", async ({
  page,
}) => {
  await page.goto("/calendar", { waitUntil: "domcontentloaded" });
  await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });

  // Compact shows one day; the seeded all-day one-off is on Tuesday.
  await page.getByRole("button", { name: /^Tue\s*\d{2}$/ }).click();
  const chip = page.getByRole("button", { name: "Pick up dry cleaning, all day" });
  await expect(chip).toBeVisible({ timeout: 10_000 });

  // Two real held touches: the first arms the chip, the second opens its menu. A synthetic
  // pointerdown cannot be held, so it could never have reached either timer.
  await armAllDayChip(page, chip);
  await longPress(page, await centreOf(chip));
  const moveItem = page.getByRole("menuitem", { name: "Move to day…" });
  await expect(moveItem).toBeVisible({ timeout: 5_000 });

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

/**
 * The all-day menu is the tall one (six items, ending in Delete) and the one whose height leaves
 * no clear vertical placement on a short viewport — so it is the menu that most needs to prove
 * the release of its own opening press reaches nothing.
 */
async function pressAllDayChipAndProbeMenu(
  page: Page,
  viewport: { width: number; height: number },
) {
  const chip = page.getByRole("button", { name: ALL_DAY_CHIP });
  await expect(chip).toBeVisible({ timeout: 10_000 });

  // The probe runs against the second press; the first leaves the chip armed underneath.
  const press = await armAllDayChip(page, chip);
  await longPress(page, press);
  await expect(page.getByRole("menuitem", { name: "Move to day…" })).toBeVisible();
  await expectMenuClearOf(page, press, { x: 0, y: 0, ...viewport });
  await expectMenuOpenAndInert(page, async () => {
    await expect(chip, "Unschedule or Delete ran").toHaveCount(1);
  });
}

test("calendar: a real held touch on an all-day chip opens its menu, firing nothing", async ({
  page,
}) => {
  const viewport = { width: 390, height: 844 };
  await page.setViewportSize(viewport);
  await page.goto("/calendar", { waitUntil: "domcontentloaded" });
  await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: /^Tue\s*\d{2}$/ }).click();
  await pressAllDayChipAndProbeMenu(page, viewport);
});

// 320×454 is the triple where no in-viewport placement of an uncapped all-day menu could clear
// the press: the panel's max-h makes one exist, and the inert panel covers it either way.
test("calendar: the all-day menu fires nothing on the shortest viewport (320x454)", async ({
  page,
}) => {
  const viewport = { width: 320, height: 454 };
  await page.setViewportSize(viewport);
  await page.goto("/calendar", { waitUntil: "domcontentloaded" });
  await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: /^Tue\s*\d{2}$/ }).click();
  await pressAllDayChipAndProbeMenu(page, viewport);
});

async function openTuesdayCalendar(page: Page, viewport = { width: 390, height: 844 }) {
  await page.setViewportSize(viewport);
  await page.goto("/calendar", { waitUntil: "domcontentloaded" });
  await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: /^Tue\s*\d{2}$/ }).click();
  const chip = page.getByRole("button", { name: ALL_DAY_CHIP });
  await expect(chip).toBeVisible({ timeout: 10_000 });
  return chip;
}

// The all-day row sits outside the timed grid's ScrollShadow, and `scrollHeight > clientHeight`
// is true of plenty of ancestors that never scroll — so read whichever one actually moved.
const allDayScrollTop = (chip: Locator) =>
  chip.evaluate((el) => {
    let top = document.scrollingElement?.scrollTop ?? 0;
    for (let node = el.parentElement; node; node = node.parentElement) {
      top = Math.max(top, node.scrollTop);
    }
    return top;
  });

test("calendar: a swipe on an un-armed all-day chip scrolls instead of rescheduling", async ({
  page,
}) => {
  const chip = await openTuesdayCalendar(page);
  const centre = await centreOf(chip);
  expect(await allDayScrollTop(chip), "already scrolled before the swipe").toBe(0);

  await swipe(page, {
    from: centre,
    to: { x: centre.x, y: centre.y - 200 },
    durationMs: 350,
    steps: 12,
  });

  await expect
    .poll(() => allDayScrollTop(chip), { message: "the swipe did not scroll" })
    .toBeGreaterThan(0);
  await expect(page.getByRole("button", { name: ALL_DAY_CHIP })).toHaveCount(1);
});

test("calendar: a first hold arms an all-day chip and a second opens its menu", async ({
  page,
}) => {
  const chip = await openTuesdayCalendar(page);

  const centre = await armAllDayChip(page, chip);
  await longPress(page, centre);

  await expect(page.getByRole("menuitem", { name: "Move to day…" })).toBeVisible();
  await expect(page.getByRole("button", { name: ALL_DAY_CHIP })).toHaveCount(1);
});

// MVP step 5 routes a blocked all-day press through chipPressRef; without the chip's new
// pointerup this tap would open nothing at all.
test("calendar: a tap on an armed all-day chip still opens the editor", async ({ page }) => {
  const chip = await openTuesdayCalendar(page);

  const centre = await armAllDayChip(page, chip);
  await tap(page, centre);

  await expect(page.getByRole("textbox", { name: "Task title" })).toHaveValue(
    "Pick up dry cleaning",
  );
});

/** A point on `target` the open menu does not cover — the menu hangs off the press it opened on. */
async function pointClearOfMenu(page: Page, target: Locator): Promise<{ x: number; y: number }> {
  const box = await target.boundingBox();
  if (box === null) throw new Error("the dismiss target has no bounding box");
  const menu = await page.getByRole("menu").boundingBox();
  if (menu === null) throw new Error("the open menu has no bounding box");
  const y = box.y + box.height / 2;
  const x = [box.x + 8, box.x + box.width / 2, box.x + box.width - 8].find(
    (candidate) =>
      candidate < menu.x ||
      candidate > menu.x + menu.width ||
      y < menu.y ||
      y > menu.y + menu.height,
  );
  if (x === undefined) throw new Error("the menu covers the whole chip");
  return { x, y };
}

test("calendar: a touch while a chip's menu is open only dismisses it, and the next one opens the chip", async ({
  page,
}) => {
  await page.goto("/calendar", { waitUntil: "domcontentloaded" });
  await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: /^Tue\s*\d{2}$/ }).click();
  const allDay = page.getByRole("button", { name: "Pick up dry cleaning, all day" });
  await expect(allDay).toBeVisible({ timeout: 10_000 });

  const timed = page.getByRole("button", { name: /, \d{2}:\d{2} to \d{2}:\d{2}/ }).first();
  await expect(timed).toBeVisible({ timeout: 10_000 });
  await timed.scrollIntoViewIfNeeded();

  const press = await armAllDayChip(page, allDay);
  await longPress(page, press);
  await expect(page.getByRole("menu")).toBeVisible();

  // The dismissing touch stops at the menu: it neither opens the chip nor arms its drag —
  // and it lands outside the armed all-day chip, so it disarms that too.
  const target = await pointClearOfMenu(page, timed);
  await tap(page, target);
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "Edit task" })).toHaveCount(0);
  await expect(page.locator('[data-armed="true"]')).toHaveCount(0);

  await tap(page, target);
  await expect(page.getByRole("dialog", { name: "Edit task" })).toBeVisible();
});

test("a long press opens the row menu while a tap still opens the card (390px)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cards", { waitUntil: "domcontentloaded" });

  const row = page.locator("[data-card-row]:visible").first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  const box = await row.boundingBox();
  if (!box) throw new Error("row has no box");

  await expect(page.getByText(/\d+ selected/)).toHaveCount(0);

  await longPress(page, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
  await expect(page.getByRole("menu")).toBeVisible();
  await page.getByRole("menuitem", { name: "Select" }).click();
  await expect(page.getByText("1 selected")).toBeVisible();

  await row.getByRole("button").first().click();
  await expect(page).toHaveURL(/\/cards\/[^/]+$/);
});

test("the cards filter opens as a centred modal on a phone (390px)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cards", { waitUntil: "domcontentloaded" });

  await page.getByRole("button", { name: "Filter cards" }).click();
  await expect(page.getByRole("dialog")).toContainText("Filter cards");
});

// ─── Bottom-fixed bars clear the nav band (spec §7) ──────────────────────────

test("the undo bar clears the nav and a nav tab still navigates under it (390px)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/today", { waitUntil: "domcontentloaded" });
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
  await page.goto(`/journal/${TODAY}`, { waitUntil: "domcontentloaded" });

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
  await page.goto(`/journal/${TODAY}`, { waitUntil: "domcontentloaded" });

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

const MIN_TOUCH_PX = 44;
const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 900, height: 844 };
const CIRCLE_DRIFT_TOLERANCE_PX = 1;

async function openPhone(page: Page, route: string) {
  await page.setViewportSize(PHONE);
  await page.goto(route, { waitUntil: "domcontentloaded" });
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

// The title's own box widens with the viewport, so the horizontal reading is taken against
// its leading edge — the gap the negative margins have to preserve.
async function measureCircleOffsetFromTitle(remaining: Locator, title: string) {
  const circle = remaining
    .getByRole("button", { name: `Mark ${title} done` })
    .locator("span")
    .first();
  const titleLine = remaining.getByText(title, { exact: true }).last();
  const circleBox = await circle.boundingBox();
  const titleBox = await titleLine.boundingBox();
  if (!circleBox || !titleBox) throw new Error("the toggle circle or the title has no box");
  return {
    dx: circleBox.x + circleBox.width / 2 - titleBox.x,
    dy: circleBox.y + circleBox.height / 2 - (titleBox.y + titleBox.height / 2),
  };
}

const ADDED_ROWS = ["Reorder First untimed", "Reorder Second untimed"];

// The sandbox seeds an untimed task on some dates, so only the added rows are asserted.
const addedRowOrder = (page: Page): Promise<string[]> =>
  page
    .locator('main [aria-label^="Reorder "]')
    .evaluateAll(
      (els, wanted) =>
        els
          .map((el) => el.getAttribute("aria-label") ?? "")
          .filter((label) => wanted.includes(label)),
      ADDED_ROWS,
    );

test("the task actions menu is visible, 44px and works by tap (390px)", async ({ page }) => {
  await openPhone(page, "/today");
  const remaining = page.getByRole("region", { name: "Remaining" });
  await expect(remaining).toBeVisible({ timeout: 15_000 });

  const trigger = remaining.locator('[aria-label^="Actions for "]').first();
  const title = ((await trigger.getAttribute("aria-label")) ?? "").replace(/^Actions for /, "");
  const { opacity, box } = await measureControl(trigger);
  expect(opacity, "the task ⋯ trigger is transparent on a phone").toBe("1");
  expectTouchSized(box, "the task ⋯ trigger");

  await trigger.click();
  await page.getByRole("menuitem", { name: "Skip" }).click();

  // The tapped card has to be the one reading Skipped, not merely some card in Done.
  const skippedCard = page
    .getByRole("region", { name: "Done" })
    .getByRole("button")
    .filter({ hasText: title })
    .filter({ hasText: "Skipped" });
  await expect(skippedCard).toHaveCount(1);
  await expect(remaining.getByRole("button", { name: `Actions for ${title}` })).toHaveCount(0);
});

test("the task done toggle has a 44px hit box and leaves the circle put (390px)", async ({
  page,
}) => {
  await openPhone(page, "/today");
  const remaining = page.getByRole("region", { name: "Remaining" });
  await expect(remaining).toBeVisible({ timeout: 15_000 });

  const toggle = remaining.locator('[aria-label^="Mark "]').first();
  const label = (await toggle.getAttribute("aria-label")) ?? "";
  const title = label.replace(/^Mark /, "").replace(/ done$/, "");
  const { box } = await measureControl(toggle);
  expectTouchSized(box, "the task done toggle");

  // The desktop reading is the pre-change position: §4's negative margins buy exactly this.
  const phoneOffset = await measureCircleOffsetFromTitle(remaining, title);
  await page.setViewportSize(DESKTOP);
  const desktopOffset = await measureCircleOffsetFromTitle(remaining, title);
  await page.setViewportSize(PHONE);
  expect(
    Math.abs(phoneOffset.dx - desktopOffset.dx),
    "the 44px hit box moved the done circle across from the title",
  ).toBeLessThanOrEqual(CIRCLE_DRIFT_TOLERANCE_PX);
  expect(
    Math.abs(phoneOffset.dy - desktopOffset.dy),
    "the 44px hit box moved the done circle down from the title",
  ).toBeLessThanOrEqual(CIRCLE_DRIFT_TOLERANCE_PX);
});

// `EntityCard`'s link covers the whole card through an `after:inset-0` overlay, which no
// bounding box can see — the anchor measures 191x22 while the live target is 358x162. A
// `position:relative` or an `overflow:hidden` on that anchor would silently collapse it
// back to the text, so the hit map is asserted where a finger actually lands.
test("the whole habit card is the link, not just its title (390px)", async ({ page }) => {
  await openPhone(page, "/habits");
  const card = page.locator("main li").first();
  const box = await card.boundingBox();
  if (!box) throw new Error("the habit card has no bounding box");
  const href = await card.getByRole("link").first().getAttribute("href");
  expect(href).toMatch(/^\/habits\//);

  const corners = { x: 10, y: 10 };
  const edges = 3;
  const points = {
    "top-left": { x: box.x + corners.x, y: box.y + corners.y },
    "top-right": { x: box.x + box.width - corners.x, y: box.y + corners.y },
    "bottom-left": { x: box.x + corners.x, y: box.y + box.height - corners.y },
    "bottom-right": { x: box.x + box.width - corners.x, y: box.y + box.height - corners.y },
    "mid-top": { x: box.x + box.width / 2, y: box.y + edges },
    "mid-bottom": { x: box.x + box.width / 2, y: box.y + box.height - edges },
    "mid-left": { x: box.x + edges, y: box.y + box.height / 2 },
    "mid-right": { x: box.x + box.width - edges, y: box.y + box.height / 2 },
  };
  const hits = await page.evaluate(
    (pts) =>
      Object.fromEntries(
        Object.entries(pts).map(([name, p]) => {
          const el = document.elementFromPoint(p.x, p.y);
          return [name, el?.closest("a")?.getAttribute("href") ?? "no link"];
        }),
      ),
    points,
  );
  for (const name of Object.keys(points)) {
    expect(hits[name], `${name} of the habit card is not the link`).toBe(href);
  }

  // A hit map is not a click: one corner has to really navigate.
  await tap(page, points["bottom-right"]);
  await expect(page).toHaveURL(new RegExp(`${href}$`));
});

// The same gesture on two surfaces must not disagree: Today's ⋯ is 44px, so the values
// list's is too, and the tap has to still reach the menu it grew around.
test("the value actions menu is 44px and works by tap (390px)", async ({ page }) => {
  await openPhone(page, "/values");

  const trigger = page.locator('main [aria-label$=" actions"]').first();
  const { opacity, box } = await measureControl(trigger);
  expect(opacity, "the value ⋯ trigger is transparent on a phone").toBe("1");
  expectTouchSized(box, "the value ⋯ trigger");

  await trigger.click();
  await expect(page.getByRole("menuitem", { name: "Add goal" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Archive" })).toBeVisible();
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

  const first = page.locator(`main [aria-label="${ADDED_ROWS[0]}"]`);
  const second = page.locator(`main [aria-label="${ADDED_ROWS[1]}"]`);
  await expect(first).toHaveCount(1);
  await expect(second).toHaveCount(1);
  expect(await addedRowOrder(page)).toEqual(ADDED_ROWS);

  await second.evaluate((el) => {
    el.scrollIntoView({ block: "center" });
  });
  const fromBox = await first.boundingBox();
  const toBox = await second.boundingBox();
  if (!fromBox || !toBox) throw new Error("a sortable row has no bounding box");
  const from = { x: fromBox.x + fromBox.width / 2, y: fromBox.y + fromBox.height / 2 };
  const to = { x: from.x, y: toBox.y + toBox.height * 0.75 };

  await startTouch(page, from);
  // TouchSensor arms at 250ms; hold still inside the 8px tolerance.
  await page.waitForTimeout(500);
  await dragAlong(page, { from, to, durationMs: 500, steps: 10 });
  await endTouch(page);

  const swapped = [ADDED_ROWS[1], ADDED_ROWS[0]];
  await expect
    .poll(() => addedRowOrder(page), { message: "the long press did not reorder the rows" })
    .toEqual(swapped);

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect
    .poll(() => addedRowOrder(page), { message: "the new order did not survive a reload" })
    .toEqual(swapped);
});
