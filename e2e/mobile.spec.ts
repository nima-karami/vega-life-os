import { expect, test } from "@playwright/test";

/**
 * Mobile-usability proof (spec §7). Runs on a touch phone profile; the @automatable
 * scenarios drive several portrait widths. Touch-drag feel, on-screen-keyboard
 * avoidance, and OS safe-area insets are manual on-device smoke — not asserted here.
 */

const IGNORE = [/Download the React DevTools/i, /\[vite\]/i, /Firebase/i];

const WIDTHS = [320, 360, 390, 430];

async function bootSandbox(page: import("@playwright/test").Page) {
  await page.goto("/", { waitUntil: "networkidle" });
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
      await page.goto(route, { waitUntil: "networkidle" });
      await passGratitudeGate(page);
      await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });

      const overflow = await horizontalOverflow(page);
      expect(
        overflow,
        `page overflows horizontally by ${overflow}px at ${width}px on ${route}`,
      ).toBeLessThanOrEqual(1);

      expect(errors, `runtime errors on ${route}:\n${errors.join("\n")}`).toEqual([]);
    });
  }
}

test("header search trigger and account control do not overlap (360px)", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/today", { waitUntil: "networkidle" });
  await passGratitudeGate(page);

  const trigger = page.getByTestId("omni-trigger");
  const account = page.getByRole("button", { name: "Account menu" });
  await expect(trigger).toBeVisible();
  await expect(account).toBeVisible();

  const a = await trigger.boundingBox();
  const b = await account.boundingBox();
  if (!a || !b) throw new Error("missing header control bounds");
  // They must not horizontally overlap: the trigger ends before the account starts.
  expect(a.x + a.width, "search trigger overlaps the account control").toBeLessThanOrEqual(b.x + 1);
  // Account control is a comfortable tap target.
  expect(b.width).toBeGreaterThanOrEqual(40);
  expect(b.height).toBeGreaterThanOrEqual(40);
});

test("habit editor opens as a sheet, scrolls, keeps title + actions visible, and closes (360px)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 720 });
  await page.goto("/habits", { waitUntil: "networkidle" });
  await passGratitudeGate(page);
  await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Add habit" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  // Fits within the viewport (full-screen sheet — no part hangs off-screen).
  const box = await dialog.boundingBox();
  if (!box) throw new Error("dialog has no bounds");
  expect(box.x).toBeGreaterThanOrEqual(-1);
  expect(box.width).toBeLessThanOrEqual(361);

  // Title (sticky header) and primary action (sticky footer) are both visible.
  await expect(dialog.getByPlaceholder("What do you want to repeat?")).toBeVisible();
  const create = dialog.getByRole("button", { name: "Create habit" });
  await expect(create).toBeVisible();

  // Body scrolls independently — the icon field is far down the form.
  await dialog.getByRole("button", { name: /Icon: change/ }).scrollIntoViewIfNeeded();
  // Footer action remains visible after scrolling the body.
  await expect(create).toBeVisible();

  // Closes.
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("calendar shows a single-day view with day navigation and no page overflow (390px)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 780 });
  await page.goto("/calendar", { waitUntil: "networkidle" });
  await passGratitudeGate(page);
  await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });

  // Single-day nav controls (per-day, not per-week).
  await expect(page.getByRole("button", { name: "Previous day" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Next day" })).toBeVisible();

  // Page body does not scroll sideways (the grid scrolls inside its own region).
  const overflow = await horizontalOverflow(page);
  expect(overflow, `calendar page overflows by ${overflow}px`).toBeLessThanOrEqual(1);
});
