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

/** Pass the forced morning gratitude gate so the task surface is reachable. */
async function passGratitudeGate(page: import("@playwright/test").Page) {
  const gate = page.getByRole("button", { name: "Continue to today" });
  if (await gate.isVisible().catch(() => false)) {
    await page.getByRole("textbox", { name: "Grateful for, item 1" }).fill("e2e gratitude");
    await gate.click();
  }
}

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
  await passGratitudeGate(page);

  // No legacy nav chrome (NavRow was a <nav>). Semantic <header>/page headers are allowed.
  await expect(page.locator("nav")).toHaveCount(0);

  // Exactly one global omni trigger — the only navigation — present and visible.
  await expect(page.getByTestId("omni-trigger")).toHaveCount(1);
  await expect(page.getByTestId("omni-trigger")).toBeVisible({ timeout: 10_000 });

  // Content in main
  const text = (await page.locator("main").innerText()).trim();
  expect(text.length, "main content too short").toBeGreaterThan(20);

  expect(errors, `runtime errors:\n${errors.join("\n")}`).toEqual([]);
});

test("onboarding: cloud-first welcome (sign-in unavailable variant in CI)", async ({ page }) => {
  // Fresh context: clear any onboarded flag so the welcome screen shows.
  await page.goto("/", { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.removeItem("vega.onboarded"));
  await page.reload({ waitUntil: "networkidle" });

  // Sample-data path is present (and is the available path with Firebase off).
  const explore = page.getByRole("button", { name: /explore with sample data/i });
  await expect(explore).toBeVisible({ timeout: 15_000 });

  // The removed local option and the dropped name capture are gone.
  await expect(page.getByRole("button", { name: /start empty/i })).toHaveCount(0);
  await expect(page.getByPlaceholder(/what should we call you/i)).toHaveCount(0);

  // Choosing sample data seeds the sandbox and enters the app (lands on the gate).
  await explore.click();
  await expect(page.getByRole("button", { name: "Continue to today" })).toBeVisible({
    timeout: 15_000,
  });
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

    await passGratitudeGate(page);
    await page.goto(path, { waitUntil: "networkidle" });

    // main content area is present
    const main = page.locator("main");
    await expect(main).toBeVisible({ timeout: 15_000 });

    // Real content rendered (not blank)
    const text = (await main.innerText()).trim();
    expect(text.length, `view "${name}" rendered too little text`).toBeGreaterThan(40);

    // No legacy nav chrome (semantic <header> is allowed in the vapor shell/pages)
    await expect(page.locator("nav")).toHaveCount(0);
    // The global omni trigger is present on every route (the only navigation).
    await expect(page.getByTestId("omni-trigger")).toHaveCount(1);

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

    await passGratitudeGate(page);
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
  await passGratitudeGate(page);
  const main = page.locator("main");
  await expect(main).toBeVisible({ timeout: 15_000 });
  // Heading + progress copy ("N of M done" or the empty-state copy).
  await expect(page.getByRole("heading", { name: "Today", exact: true })).toBeVisible();
  await expect(main).toContainText(/(\d+ of \d+ done|Nothing scheduled)/);
});

test("completing a remaining task moves it to Done and updates progress", async ({ page }) => {
  await page.goto("/today", { waitUntil: "networkidle" });
  await passGratitudeGate(page);
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
  await passGratitudeGate(page);
  await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });

  // Expand the inline capture and type a title.
  await page
    .getByRole("button", { name: /^Add task$/ })
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

// ─── Calendar: slot create / draft discard / right-click delete ───────────────

test("calendar: opening a slot then closing without naming discards the draft", async ({
  page,
}) => {
  await passGratitudeGate(page);
  await page.goto("/calendar", { waitUntil: "networkidle" });
  await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });

  // Click an empty slot near the top of the first day column → creates a draft.
  const addSlot = page.getByRole("button", { name: /^Add task on/ }).first();
  await addSlot.click({ position: { x: 20, y: 30 } });

  // The editor opens on the placeholder draft.
  const title = page.getByRole("textbox", { name: "Task title" });
  await expect(title).toBeVisible({ timeout: 10_000 });
  await expect(title).toHaveValue("New task");

  // Close without naming → the placeholder task must NOT survive.
  await page.getByRole("contentinfo").getByRole("button", { name: "Done" }).click();
  await expect(title).toBeHidden();
  await expect(page.getByText("New task", { exact: true })).toHaveCount(0);
});

test("calendar: right-click a chip → Delete removes it", async ({ page }) => {
  await passGratitudeGate(page);
  await page.goto("/calendar", { waitUntil: "networkidle" });
  await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });

  // Create a uniquely-named task via a slot click, then close to keep it.
  const addSlot = page.getByRole("button", { name: /^Add task on/ }).first();
  await addSlot.click({ position: { x: 20, y: 60 } });
  const title = page.getByRole("textbox", { name: "Task title" });
  await expect(title).toBeVisible({ timeout: 10_000 });
  const unique = `CtxDelete ${Date.now()}`;
  await title.fill(unique);
  await page.getByRole("contentinfo").getByRole("button", { name: "Done" }).click();
  await expect(title).toBeHidden();

  // The named chip is on the grid.
  const chip = page.getByText(unique, { exact: true });
  await expect(chip).toBeVisible();

  // Right-click it → context menu → Delete actually removes it.
  await chip.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await expect(page.getByText(unique, { exact: true })).toHaveCount(0);
});

test("calendar: right-click an empty slot → add / schedule menu", async ({ page }) => {
  await passGratitudeGate(page);
  await page.goto("/calendar", { waitUntil: "networkidle" });
  await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });

  // Right-click an empty area of the first day column.
  const addSlot = page.getByRole("button", { name: /^Add task on/ }).first();
  await addSlot.scrollIntoViewIfNeeded();
  await addSlot.click({ button: "right", position: { x: 20, y: 150 } });

  // The slot menu offers Add + Schedule (Paste only appears with a clipboard).
  const menu = page.getByRole("menu", { name: "Slot actions" });
  await expect(menu).toBeVisible({ timeout: 10_000 });
  await expect(menu.getByRole("menuitem", { name: "Add task here" })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: /Schedule existing task/ })).toBeVisible();

  // "Add task here" opens the editor on a fresh draft.
  await menu.getByRole("menuitem", { name: "Add task here" }).click();
  await expect(page.getByRole("textbox", { name: "Task title" })).toBeVisible({ timeout: 10_000 });
});

test("calendar: schedule an existing task from the slot menu", async ({ page }) => {
  await passGratitudeGate(page);
  await page.goto("/calendar", { waitUntil: "networkidle" });
  await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });

  const addSlot = page.getByRole("button", { name: /^Add task on/ }).first();
  await addSlot.click({ button: "right", position: { x: 20, y: 150 } });

  await page
    .getByRole("menu", { name: "Slot actions" })
    .getByRole("menuitem", { name: /Schedule existing task/ })
    .click();

  // The picker lists unscheduled tasks (seed has several).
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Schedule a task", { timeout: 10_000 });
  const firstRow = dialog.locator("li button").first();
  await expect(firstRow).toBeVisible();
  const picked = (await firstRow.innerText()).trim();

  // Pick it → it gets scheduled and shows up on the grid as a chip.
  await firstRow.click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(picked, { exact: true })).toBeVisible();
});

test("calendar: all-day chip right-click → menu parity (Open · Copy · Delete · Schedule)", async ({
  page,
}) => {
  await passGratitudeGate(page);
  await page.goto("/calendar", { waitUntil: "networkidle" });
  await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });

  // The seeded all-day task lives in the all-day row (this week, always visible).
  const chip = page.getByRole("button", { name: "Pick up dry cleaning, all day" });
  await expect(chip).toBeVisible({ timeout: 10_000 });

  await chip.click({ button: "right" });
  const menu = page.getByRole("menu");
  await expect(menu.getByRole("menuitem", { name: "Open" })).toBeVisible({ timeout: 10_000 });
  await expect(menu.getByRole("menuitem", { name: "Copy" })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Delete" })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Schedule to time…" })).toBeVisible();
});

test("calendar: 'Schedule to time…' gives an all-day task a time (leaves the all-day row)", async ({
  page,
}) => {
  await passGratitudeGate(page);
  await page.goto("/calendar", { waitUntil: "networkidle" });
  await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });

  const allDay = page.getByRole("button", { name: "Pick up dry cleaning, all day" });
  await expect(allDay).toBeVisible({ timeout: 10_000 });
  await allDay.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Schedule to time…" }).click();

  // The schedule-to-time dialog opens; pick a start time from the picker.
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Schedule to a time", { timeout: 10_000 });
  await dialog.getByRole("button", { name: /^09:00/ }).click(); // open the time popover
  // The popover portals outside the aria-modal; target its slot by exact text.
  await page.locator('button:text-is("10:00")').click();

  // It is now a 60-min timed block and no longer in the all-day row.
  await expect(page.getByRole("button", { name: "Pick up dry cleaning, all day" })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Pick up dry cleaning, 10:00–11:00/ }),
  ).toBeVisible();
});

test("calendar: relink a detached habit instance snaps it back to the template", async ({
  page,
}) => {
  await passGratitudeGate(page);
  await page.goto("/calendar", { waitUntil: "networkidle" });
  await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });

  // Seed has a detached h1 instance ("Read — finish 'Sapiens' ch.9", Wed 20:00).
  const detached = page.getByRole("button", { name: /Read — finish 'Sapiens' ch.9, .*detached/ });
  await expect(detached).toBeVisible({ timeout: 10_000 });

  await detached.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Relink to habit" }).click();

  // Confirms the action ran; the custom title is gone (snapped back to the template,
  // which renders identically to h1's other daily instances).
  await expect(page.getByText("Relinked to habit").first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("button", { name: /Read — finish 'Sapiens'/ })).toHaveCount(0);
});

test("calendar: ⌘-click multi-selects chips and the bulk bar reports the count", async ({
  page,
}) => {
  await passGratitudeGate(page);
  await page.goto("/calendar", { waitUntil: "networkidle" });
  await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });

  const a = page.getByRole("button", { name: /^Update ID card, 13:00/ });
  const b = page.getByRole("button", { name: /^Mock interview w\/ Dana, 16:00/ });
  await a.scrollIntoViewIfNeeded();
  await a.click({ modifiers: ["ControlOrMeta"] });
  await b.click({ modifiers: ["ControlOrMeta"] });

  const bar = page.getByRole("toolbar", { name: "Bulk actions" });
  await expect(bar).toContainText("2 selected", { timeout: 10_000 });
  await expect(a).toHaveAttribute("aria-pressed", "true");

  // Esc clears the selection and hides the bar.
  await page.keyboard.press("Escape");
  await expect(bar).toBeHidden();
});

test("calendar: bulk delete removes the selection and Undo restores it", async ({ page }) => {
  await passGratitudeGate(page);
  await page.goto("/calendar", { waitUntil: "networkidle" });
  await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });

  const a = page.getByRole("button", { name: /^Update ID card, 13:00/ });
  const b = page.getByRole("button", { name: /^Mock interview w\/ Dana, 16:00/ });
  await a.scrollIntoViewIfNeeded();
  await a.click({ modifiers: ["ControlOrMeta"] });
  await b.click({ modifiers: ["ControlOrMeta"] });

  await page
    .getByRole("toolbar", { name: "Bulk actions" })
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(page.getByRole("button", { name: /^Update ID card/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Mock interview w\/ Dana/ })).toHaveCount(0);

  // Undo brings the whole batch back.
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("button", { name: /^Update ID card, 13:00/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Mock interview w\/ Dana, 16:00/ })).toBeVisible();
});

test("calendar: bulk Set status marks the whole selection done", async ({ page }) => {
  await passGratitudeGate(page);
  await page.goto("/calendar", { waitUntil: "networkidle" });
  await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });

  const card = page.getByRole("button", { name: /^Update ID card, 13:00/ });
  await card.scrollIntoViewIfNeeded();
  await card.click({ modifiers: ["ControlOrMeta"] });

  await page
    .getByRole("toolbar", { name: "Bulk actions" })
    .getByRole("button", { name: "Set status" })
    .click();
  await page.getByRole("menuitem", { name: "Done" }).click();

  await expect(page.getByRole("button", { name: /^Update ID card, 13:00.*done/ })).toBeVisible();
});

// ─── Settings: appearance accent re-tints the whole app ───────────────────────

const primaryToken = (page: import("@playwright/test").Page) =>
  page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--heroui-primary").trim(),
  );

test("settings: choosing an accent re-tints the HeroUI primary and persists; Default reverts", async ({
  page,
}) => {
  await passGratitudeGate(page);
  await page.goto("/settings", { waitUntil: "networkidle" });
  await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });

  // Baseline = the configured slate primary.
  const slate = await primaryToken(page);
  expect(slate).toBe("210 29.09% 43.14%");

  // Pick Teal → the primary token changes to the teal hue everywhere.
  await page.getByRole("button", { name: "Teal", exact: true }).click();
  await expect.poll(() => primaryToken(page)).not.toBe(slate);
  const teal = await primaryToken(page);
  expect(teal).toBe("173.96 61.78% 44.12%"); // #2bb6a8 → HSL channels

  // A primary-colored control actually adopts it (not just the raw var).
  const exportBtn = page.getByRole("button", { name: /Export backup/ });
  await expect(exportBtn).toBeVisible();

  // Persists across reload.
  await page.reload({ waitUntil: "networkidle" });
  await expect.poll(() => primaryToken(page)).toBe(teal);

  // Default clears the override → back to slate.
  await page.getByRole("button", { name: "Default", exact: true }).click();
  await expect.poll(() => primaryToken(page)).toBe(slate);
});

test("settings: About reflects the signed-out (sample data) state", async ({ page }) => {
  await passGratitudeGate(page);
  await page.goto("/settings", { waitUntil: "networkidle" });
  const main = page.locator("main");
  await expect(main).toBeVisible({ timeout: 15_000 });
  await expect(main).toContainText("This device (sample data)");
  await expect(main).toContainText("Sign in to enable");
  await expect(main).not.toContainText("IndexedDB (local)");
  await expect(main).not.toContainText("not connected");
});

// ─── Today: step between days + jump back ─────────────────────────────────────

test("today: step back/forward a day and jump back to today", async ({ page }) => {
  await page.goto("/today", { waitUntil: "networkidle" });
  await passGratitudeGate(page);
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toHaveText("Today", { timeout: 15_000 });

  // No "Jump to today" while on today.
  await expect(page.getByRole("button", { name: "Jump to today" })).toBeHidden();

  // Step back a day → Yesterday, and the jump-back affordance appears.
  await page.getByRole("button", { name: "Previous day" }).click();
  await expect(heading).toHaveText("Yesterday");
  const jump = page.getByRole("button", { name: "Jump to today" });
  await expect(jump).toBeVisible();

  // Forward two days → Tomorrow.
  await page.getByRole("button", { name: "Next day" }).click();
  await page.getByRole("button", { name: "Next day" }).click();
  await expect(heading).toHaveText("Tomorrow");

  // Jump back → Today, affordance gone.
  await jump.click();
  await expect(heading).toHaveText("Today");
  await expect(page.getByRole("button", { name: "Jump to today" })).toBeHidden();
});

test("today: the date picker jumps to a chosen day", async ({ page }) => {
  await page.goto("/today", { waitUntil: "networkidle" });
  await passGratitudeGate(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Today", { timeout: 15_000 });

  // Open the calendar and pick the 1st of the visible month.
  await page.getByRole("button", { name: "Pick a date" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "1", exact: true }).first().click();

  // We've left "today" — the jump-back affordance is now shown.
  await expect(page.getByRole("button", { name: "Jump to today" })).toBeVisible();
});

// ─── Daily reflection: morning gratitude gate ────────────────────────────────

test("today: gratitude gate blocks tasks until ≥1 is written, with no skip", async ({ page }) => {
  await page.goto("/today", { waitUntil: "networkidle" });

  // The gate is shown; the task surface is not reachable yet.
  const cont = page.getByRole("button", { name: "Continue to today" });
  await expect(cont).toBeVisible({ timeout: 15_000 });
  await expect(cont).toBeDisabled();
  await expect(page.getByRole("region", { name: "Remaining" })).toBeHidden();

  // There is no skip control anywhere on the gate.
  await expect(page.getByRole("button", { name: /skip/i })).toHaveCount(0);

  // The shell is sealed: no search bar, and other routes bounce back to the gate.
  await expect(page.getByTestId("omni-trigger")).toHaveCount(0);
  await page.goto("/habits", { waitUntil: "networkidle" });
  await expect(cont).toBeVisible();
  await expect(page.getByTestId("omni-trigger")).toHaveCount(0);

  // Writing one gratitude enables Continue, reveals the tasks, and unseals the shell.
  await page.getByRole("textbox", { name: "Grateful for, item 1" }).fill("Sunshine");
  await expect(cont).toBeEnabled();
  await cont.click();
  await expect(page.getByRole("region", { name: "Remaining" })).toBeVisible();
  await expect(page.getByTestId("omni-trigger")).toHaveCount(1);

  // Reloading goes straight to tasks (gate satisfied, data-driven).
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("region", { name: "Remaining" })).toBeVisible();
});

// ─── Daily reflection: end-of-day reflection step ────────────────────────────

test("today: reflection step appears once all tasks are resolved, and can be skipped", async ({
  page,
}) => {
  await page.goto("/today", { waitUntil: "networkidle" });
  await passGratitudeGate(page);

  // Resolve every remaining task via its "Mark … done" control.
  const remaining = page.getByRole("region", { name: "Remaining" });
  await expect(remaining).toBeVisible({ timeout: 15_000 });
  for (;;) {
    const next = remaining.getByRole("button", { name: /^Mark .+ done$/ }).first();
    if (!(await next.isVisible().catch(() => false))) break;
    await next.click();
  }

  // The full-screen reflection step now shows.
  const reflectHeading = page.getByRole("heading", { name: "Reflect on today" });
  await expect(reflectHeading).toBeVisible({ timeout: 10_000 });

  // Minimal skip returns to the all-done task view and does not re-yank.
  await page.getByRole("button", { name: "Skip reflection" }).click();
  await expect(reflectHeading).toBeHidden();
  await expect(page.getByText("Nothing left for today")).toBeVisible();
});

// ─── Daily reflection: journal editor edit / delete / undo ───────────────────

test("today: journal page saves a note and supports delete + undo", async ({ page }) => {
  await page.goto("/today", { waitUntil: "networkidle" });
  await passGratitudeGate(page);

  // Open the full-screen journal page and write a note in the rich editor.
  await page.getByRole("button", { name: /^Journal$|^Edit entry$/ }).click();
  await expect(page).toHaveURL(/\/journal\/\d{4}-\d{2}-\d{2}$/);
  const editor = page.getByRole("textbox", { name: "Journal" });
  await expect(editor).toBeVisible();
  await editor.click();
  await editor.pressSequentially("A calm, productive day.");
  await expect(editor).toContainText("A calm, productive day.");

  // Back to Today — the entry persisted (button now says "Edit entry").
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page).toHaveURL(/\/(today)?$/);
  await expect(page.getByRole("button", { name: "Edit entry" })).toBeVisible();

  // Re-open, delete via the confirm dialog, then undo restores it.
  await page.getByRole("button", { name: "Edit entry" }).click();
  await page.getByRole("button", { name: "Delete entry" }).click();
  await page
    .getByRole("dialog")
    .filter({ hasText: "Delete this day's entry?" })
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(page.locator(".fixed").getByText("Entry deleted", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("button", { name: "Edit entry" })).toBeVisible();
});

// ─── Data lifecycle: signed-out sandbox scope ────────────────────────────────

test("settings: reset demo data is available signed-out and reloads the sandbox", async ({
  page,
}) => {
  await passGratitudeGate(page);
  await page.goto("/settings", { waitUntil: "networkidle" });
  await expect(page.getByRole("button", { name: "Reset demo data" })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole("button", { name: "Reset demo data" }).click();
  await expect(page.locator(".fixed").getByText("Demo data reset", { exact: true })).toBeVisible();
});

test("settings: delete all (this device) empties the sandbox", async ({ page }) => {
  await passGratitudeGate(page);
  await page.goto("/settings", { waitUntil: "networkidle" });
  await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Delete all (this device)" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Delete everything" }).click();
  await expect(page.locator(".fixed").getByText("All data deleted", { exact: true })).toBeVisible();
  // App still functional after a wipe.
  await page.goto("/today", { waitUntil: "networkidle" });
  await expect(page.locator("main")).toBeVisible();
});

// ─── Deferred create: cancelling "Add" persists nothing ──────────────────────

test("habits: cancelling Add creates no habit", async ({ page }) => {
  await passGratitudeGate(page);
  await page.goto("/habits", { waitUntil: "networkidle" });
  await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });

  const cards = page.getByRole("button", { name: /^Edit / });
  const before = await cards.count();

  await page.getByRole("button", { name: "Add habit" }).click();
  await expect(page.getByRole("button", { name: "Create habit" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();

  await expect(page.getByRole("button", { name: "Create habit" })).toBeHidden();
  await expect(cards).toHaveCount(before);
});

test("values: cancelling Add creates no value", async ({ page }) => {
  await passGratitudeGate(page);
  await page.goto("/values", { waitUntil: "networkidle" });
  await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });

  const cards = page.getByRole("button", { name: /^Edit / });
  const before = await cards.count();

  await page.getByRole("button", { name: "Add value" }).click();
  await expect(page.getByRole("button", { name: "Create value" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();

  await expect(page.getByRole("button", { name: "Create value" })).toBeHidden();
  await expect(cards).toHaveCount(before);
});

test("goal steps: inline rename and reorder", async ({ page }) => {
  await passGratitudeGate(page);
  await page.goto("/values", { waitUntil: "networkidle" });
  await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });

  // Create a fresh goal — opens the goal editor on an empty step list.
  await page.getByRole("button", { name: "Add goal" }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  // Add three steps.
  const stepInput = dialog.getByRole("textbox", { name: "Add a step" });
  for (const name of ["Alpha", "Bravo", "Charlie"]) {
    await stepInput.fill(name);
    await stepInput.press("Enter");
    await expect(dialog.getByRole("button", { name: `Reorder ${name}` })).toBeVisible();
  }

  // Inline rename: click the step name, edit, commit with Enter.
  await dialog.getByRole("button", { name: "Alpha", exact: true }).click();
  const edit = dialog.getByRole("textbox", { name: "Edit Alpha" });
  await edit.fill("Alpha renamed");
  await edit.press("Enter");
  await expect(dialog.getByRole("button", { name: "Reorder Alpha renamed" })).toBeVisible();

  const stepOrder = () =>
    dialog
      .locator('[aria-label^="Reorder "]')
      .evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")?.replace("Reorder ", "")));

  expect(await stepOrder()).toEqual(["Alpha renamed", "Bravo", "Charlie"]);

  // Keyboard reorder (the accessible path): focus the handle, Space to pick up,
  // ArrowDown one slot, Space to drop. Settle between keys so dnd-kit can measure.
  await dialog.getByRole("button", { name: "Reorder Alpha renamed" }).focus();
  await page.keyboard.press("Space");
  await page.waitForTimeout(200);
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(200);
  await page.keyboard.press("Space");

  await expect.poll(stepOrder).toEqual(["Bravo", "Alpha renamed", "Charlie"]);
});

test("anytime habit: shows in the Daily habits strip, not the task list or calendar", async ({
  page,
}) => {
  await passGratitudeGate(page);
  await page.goto("/today", { waitUntil: "networkidle" });
  await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });
  await passGratitudeGate(page);

  // The seeded anytime habit "Drink water" lives in the Daily habits strip.
  const strip = page.getByRole("region", { name: "Daily habits" });
  await expect(strip).toBeVisible();
  await expect(strip.getByText("Drink water")).toBeVisible();

  // It is not duplicated into the Remaining task list.
  await expect(
    page.getByRole("region", { name: "Remaining" }).getByText("Drink water"),
  ).toHaveCount(0);

  // Checking it toggles its state.
  await strip.getByRole("button", { name: "Mark Drink water done" }).click();
  await expect(strip.getByRole("button", { name: "Mark Drink water not done" })).toBeVisible();

  // It never appears on the calendar (off-calendar by design).
  await page.goto("/calendar", { waitUntil: "networkidle" });
  await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Drink water")).toHaveCount(0);
});

test("habit editor: the Anytime toggle creates an untimed habit", async ({ page }) => {
  await passGratitudeGate(page);
  await page.goto("/habits", { waitUntil: "networkidle" });
  await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Add habit" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByPlaceholder("What do you want to repeat?").fill("Stretch");

  // Switch to Anytime — time + duration disappear.
  await dialog.getByRole("button", { name: "Anytime" }).click();
  await expect(dialog.getByText("No set time", { exact: false })).toBeVisible();

  await dialog.getByRole("button", { name: "Create habit" }).click();
  await expect(dialog).toBeHidden();

  // The new habit shows as "Anytime" on the Habits page (time saved as null, not 09:00).
  const card = page.getByRole("button", { name: "Edit Stretch" });
  await expect(card).toBeVisible();
  await expect(card.getByText("Anytime")).toBeVisible();
});
