import { expect, type Page, test } from "@playwright/test";
import { DAY_MS, enterApp, gratitudePage } from "./app";
import { countOf, readMotion, recordMotion } from "./motion-log";
import { readStoredRows } from "./stored-rows";

const LINES = ["Morning light", "Coffee with Robin"];

function todayAt(hours: number, minutes = 0): number {
  const time = new Date();
  time.setHours(hours, minutes, 0, 0);
  return time.getTime();
}

function formatLocalISO(ms: number): string {
  const day = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
}

/** Past the 200ms carry start, short of the 360ms skip end. */
const CARRY_STEP_MS = 250;

const layer = (page: Page) => page.locator(".gratitude-layer");
const pill = (page: Page) => page.getByRole("button", { name: "Edit entry" });
const continueButton = (page: Page) =>
  gratitudePage(page).getByRole("button", { name: "Continue" });
const todayHeading = (page: Page) =>
  page.getByRole("heading", { name: "Today", level: 1, exact: true });

async function writeLines(page: Page, route: string) {
  await page.goto(route);
  const prompt = gratitudePage(page);
  await expect(prompt).toBeVisible({ timeout: 20_000 });
  for (const [i, line] of LINES.entries()) {
    await prompt.getByRole("textbox", { name: `Grateful for, item ${i + 1}` }).fill(line);
  }
}

async function isLinesStored(page: Page): Promise<boolean> {
  const entries = await readStoredRows<{ gratitude: string[] }>(page, "journal");
  return entries.some((entry) => LINES.every((line) => entry.gratitude.includes(line)));
}

/** Freezes the page's timers a moment from now, so a departure cannot finish on its own. */
async function holdClock(page: Page, aheadMs = 100) {
  const pageNow = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(pageNow + aheadMs);
}

/** Two taps on Continue, faster than the 900ms departure, at the button's own spot. */
async function doubleTapContinue(page: Page) {
  const box = await continueButton(page).boundingBox();
  if (!box) throw new Error("Continue has no box");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.click(x, y);
  await page.mouse.click(x, y);
}

async function expectSettledOnToday(page: Page) {
  await expect(layer(page)).toHaveCount(0);
  await expect(todayHeading(page)).toBeVisible();
  await expect(pill(page)).toBeVisible();
  await expect(pill(page).locator(".journal-entry-dot")).toHaveCSS("opacity", "1");
  // Nothing may keep filling once it lands, or the pill would lose its own press feedback.
  await expect
    .poll(() => pill(page).evaluate((el) => el.getAnimations({ subtree: true }).length))
    .toBe(0);
  // The mark goes with the landing, so a later render of the dot never fades it in again.
  await expect(pill(page)).not.toHaveAttribute("data-gratitude-landing");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect.poll(() => isLinesStored(page)).toBe(true);
}

function describeCarry() {
  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: todayAt(12) });
    await recordMotion(page);
    await enterApp(page, { keepGratitudePage: true });
  });

  test("the lines carry into the pill once, then Today is left as it was", async ({ page }) => {
    await writeLines(page, "/");
    await holdClock(page);
    await doubleTapContinue(page);
    await page.clock.runFor(CARRY_STEP_MS);
    await expect(layer(page)).toHaveAttribute("data-departure", "kept");
    await expect(layer(page)).toHaveAttribute("data-carry", "aim");
    await expect(pill(page)).toHaveAttribute("data-gratitude-landing", "");
    await page.clock.resume();

    await expectSettledOnToday(page);
    const { animations } = await readMotion(page);
    expect(countOf(animations, "gratitude-carry")).toBe(LINES.length);
    expect(countOf(animations, "gratitude-pop")).toBe(1);
    expect(countOf(animations, "journal-pill-pop")).toBe(1);
    expect(countOf(animations, "journal-dot-in")).toBe(1);
  });

  test("under reduced motion every beat is a fade: nothing flies, pops or moves", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await writeLines(page, "/");
    await holdClock(page);
    await continueButton(page).click();
    await page.clock.runFor(CARRY_STEP_MS);
    await expect(layer(page)).toHaveAttribute("data-carry", "aim");
    await page.clock.resume();

    await expectSettledOnToday(page);
    const { animations } = await readMotion(page);
    expect(animations).not.toContain("gratitude-carry");
    expect(animations).not.toContain("gratitude-pop");
    expect(animations).not.toContain("journal-pill-pop");
    expect(animations).toContain("gratitude-fade-out");
    expect(animations).toContain("journal-dot-in");
  });

  test("a route with no pill fades the lines out where they are", async ({ page }) => {
    await writeLines(page, "/settings");
    await holdClock(page);
    await continueButton(page).click();
    await page.clock.runFor(CARRY_STEP_MS);
    await expect(layer(page)).toHaveAttribute("data-carry", "fade");
    await page.clock.resume();

    await expect(layer(page)).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Settings", level: 1, exact: true }),
    ).toBeVisible();
    expect((await readMotion(page)).animations).not.toContain("gratitude-carry");
  });

  test("Today showing another day never catches today's lines", async ({ page }) => {
    await writeLines(page, `/?date=${formatLocalISO(todayAt(12) - DAY_MS)}`);
    await holdClock(page);
    await continueButton(page).click();
    await page.clock.runFor(CARRY_STEP_MS);
    await expect(layer(page)).toHaveAttribute("data-carry", "fade");
    await page.clock.resume();

    await expect(layer(page)).toHaveCount(0);
    await expect(page.locator("[data-gratitude-target]")).toHaveCount(0);
    await expect(page.locator("[data-gratitude-landing]")).toHaveCount(0);
    expect((await readMotion(page)).animations).not.toContain("gratitude-carry");
  });

  test("nothing written takes the quick skip fade", async ({ page }) => {
    await page.goto("/");
    await expect(gratitudePage(page)).toBeVisible({ timeout: 20_000 });
    await holdClock(page);
    await continueButton(page).click();
    await page.clock.runFor(CARRY_STEP_MS);
    await expect(layer(page)).toHaveAttribute("data-departure", "skip");
    await page.clock.resume();

    await expect(layer(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Journal" })).toBeVisible();
    expect((await readMotion(page)).animations).not.toContain("gratitude-carry");
  });
}

function describeOnHeldClock() {
  test("the entry is stored on the tap, so a reload mid-departure keeps the page down", async ({
    page,
  }) => {
    await page.clock.install({ time: todayAt(12) });
    await enterApp(page, { keepGratitudePage: true });
    await writeLines(page, "/");
    await holdClock(page);
    await continueButton(page).click();
    await expect(layer(page)).toHaveAttribute("data-departure", "kept");

    await expect.poll(() => isLinesStored(page)).toBe(true);
    await expect(layer(page)).toHaveAttribute("data-departure", "kept");
    await page.clock.resume();
    await page.reload();
    await expect(todayHeading(page)).toBeVisible({ timeout: 20_000 });
    await expect(gratitudePage(page)).toHaveCount(0);
  });

  test("a departure that crosses midnight hands over to a live page for the new day", async ({
    page,
  }) => {
    const lastMinute = todayAt(23, 59);
    await page.clock.install({ time: lastMinute });
    await enterApp(page, { keepGratitudePage: true });
    await writeLines(page, "/");
    await page.clock.pauseAt(lastMinute + 59_500);
    await continueButton(page).click();
    await expect(layer(page)).toHaveAttribute("data-departure", "kept");

    await page.clock.runFor(1_000);
    await expect(gratitudePage(page)).toBeVisible();
    await expect(layer(page)).toHaveCount(1);
    await expect(layer(page)).not.toHaveAttribute("data-departure");
    await expect(gratitudePage(page)).not.toHaveAttribute("inert");
    const firstLine = gratitudePage(page).getByRole("textbox", { name: "Grateful for, item 1" });
    await expect(firstLine).toHaveValue("");
    await firstLine.fill("A new day");
    await expect(firstLine).toHaveValue("A new day");
    await expect.poll(() => isLinesStored(page)).toBe(true);
  });
}

/** Gratitude B · Carry to entry: the written lines fly into Today's "Edit entry" pill. */
export function describeGratitudeCarry() {
  test.describe("carry", describeCarry);
  test.describe("on a held clock", describeOnHeldClock);
}
