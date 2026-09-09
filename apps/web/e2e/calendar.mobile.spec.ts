import { expect, type Page, test } from "@playwright/test";
import { longPress, penDrag, startTouch, dragAlong, endTouch, tap } from "./helpers/touch";

/**
 * Touch safety for the calendar's timed grid (spec
 * docs/specs/2026-09-04-calendar-touch.md): a finger scrolls, it never reschedules.
 * Both widths run here — a touchscreen laptop is past `sm` and still has only fingers.
 */

const PHONE = { width: 390, height: 844 };
const WIDE = { width: 900, height: 900 };
// Both ends of the range, so one read covers the start time and the duration.
const CHIP_LABEL = /^Update ID card, 13:00–14:00/;

async function passGratitudeGate(page: Page) {
  const gate = page.getByRole("button", { name: "Continue to today" });
  if (await gate.isVisible().catch(() => false)) {
    await page.getByRole("textbox", { name: "Grateful for, item 1" }).fill("e2e gratitude");
    await gate.click();
  }
}

async function openCalendar(page: Page, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const explore = page.getByRole("button", { name: /explore with sample data/i });
  const main = page.locator("main");
  await expect(explore.or(main)).toBeVisible({ timeout: 20_000 });
  if (await explore.isVisible().catch(() => false)) {
    await explore.click();
    await expect(main).toBeVisible({ timeout: 15_000 });
  }
  await passGratitudeGate(page);
  await page.goto("/calendar", { waitUntil: "domcontentloaded" });
  await expect(main).toBeVisible({ timeout: 15_000 });
}

async function findSeededChip(page: Page) {
  const chip = page.getByRole("button", { name: CHIP_LABEL });
  await expect(chip).toBeVisible({ timeout: 15_000 });
  await chip.scrollIntoViewIfNeeded();
  return chip;
}

// The seeded "Update ID card" sits on the week's Thursday; the day strip is the only way
// to reach it on a phone, and the label is derived from the week so no date is pinned.
async function openSeededChipDay(page: Page) {
  await openCalendar(page, PHONE);
  await page
    .locator("main button")
    .filter({ hasText: /^Thu\d{2}$/ })
    .first()
    .click();
  return findSeededChip(page);
}

// gridRef is a fixed-height div that never scrolls; the real scroller is ScrollShadow's
// internal node, which the calendar exposes no handle for.
const maxScrollTop = (page: Page) =>
  page.evaluate(() =>
    Math.max(0, ...[...document.querySelectorAll("div")].map((el) => el.scrollTop)),
  );

test("a swipe that starts on a timed chip scrolls the grid and moves nothing", async ({ page }) => {
  const chip = await openSeededChipDay(page);
  const box = await chip.boundingBox();
  if (!box) throw new Error("the timed chip has no bounding box");
  const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  expect(await maxScrollTop(page), "the grid is already scrolled before the swipe").toBe(0);

  await startTouch(page, from);
  await dragAlong(page, { from, to: { x: from.x, y: from.y - 220 }, durationMs: 300, steps: 12 });
  await endTouch(page);

  await expect
    .poll(() => maxScrollTop(page), { message: "the swipe did not scroll the grid" })
    .toBeGreaterThan(0);
  await expect(page.getByRole("button", { name: CHIP_LABEL })).toHaveCount(1);
  await expect(page.getByText("Couldn’t save that change")).toHaveCount(0);
  await expect(page.getByRole("status")).not.toContainText("Moved to");
});

// A pen hovers like a mouse but aims like a finger, so on a phone it takes the finger branch.
test("a pen drag on a timed chip writes nothing at phone width", async ({ page }) => {
  const chip = await openSeededChipDay(page);
  const box = await chip.boundingBox();
  if (!box) throw new Error("the timed chip has no bounding box");
  const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

  // A pen tap first, so the negatives below cannot pass on a pen channel that reaches nothing.
  await penDrag(page, { from, to: from, durationMs: 40, steps: 1 });
  await expect(page.getByRole("textbox", { name: "Task title" })).toHaveValue("Update ID card");
  await page.keyboard.press("Escape");

  await penDrag(page, { from, to: { x: from.x, y: from.y + 92 }, durationMs: 300, steps: 12 });

  await expect(page.getByRole("button", { name: CHIP_LABEL })).toHaveCount(1);
  await expect(page.getByRole("status")).not.toContainText("Moved to");
});

test("a long press on a timed chip opens its menu and leaves the time alone", async ({ page }) => {
  const chip = await openSeededChipDay(page);
  const box = await chip.boundingBox();
  if (!box) throw new Error("the timed chip has no bounding box");

  await longPress(page, { x: box.x + box.width / 2, y: box.y + box.height / 2 });

  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  for (const item of ["Copy", "Unschedule", "Delete"]) {
    await expect(menu.getByRole("menuitem", { name: item })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: CHIP_LABEL })).toHaveCount(1);
});

test("a tap on a timed chip's top edge opens the editor instead of resizing", async ({ page }) => {
  const chip = await openSeededChipDay(page);
  const box = await chip.boundingBox();
  if (!box) throw new Error("the timed chip has no bounding box");

  await tap(page, { x: box.x + box.width / 2, y: box.y + 3 });

  await expect(page.getByRole("textbox", { name: "Task title" })).toHaveValue("Update ID card");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: CHIP_LABEL })).toHaveCount(1);
});

// Past sm the chip body does arm a drag, so a grip press that falls through to it
// reschedules the event instead of resizing it — the width no phone test reaches.
test("a touch drag on a resize grip writes nothing at 900px", async ({ page }) => {
  await openCalendar(page, WIDE);
  const chip = await findSeededChip(page);
  const box = await chip.boundingBox();
  if (!box) throw new Error("the timed chip has no bounding box");
  const grip = { x: box.x + box.width / 2, y: box.y + 3 };

  await startTouch(page, grip);
  await dragAlong(page, {
    from: grip,
    to: { x: grip.x, y: grip.y + 92 },
    durationMs: 300,
    steps: 12,
  });
  await endTouch(page);

  await expect(page.getByRole("button", { name: CHIP_LABEL })).toHaveCount(1);
  await expect(page.getByRole("status")).not.toContainText("Moved to");
});

// Past sm a pen is a precision pointer that reveals the grips by hovering, so it resizes.
test("a pen drag on the top grip resizes the chip at 900px", async ({ page }) => {
  await openCalendar(page, WIDE);
  const chip = await findSeededChip(page);
  const box = await chip.boundingBox();
  if (!box) throw new Error("the timed chip has no bounding box");
  const grip = { x: box.x + box.width / 2, y: box.y + 3 };

  // 92px is two hour rows, so the 13:00 start walks back to 11:00 with the end pinned.
  await penDrag(page, {
    from: grip,
    to: { x: grip.x, y: grip.y - 92 },
    durationMs: 300,
    steps: 12,
  });

  await expect(page.getByRole("button", { name: /^Update ID card, 11:00–14:00/ })).toBeVisible();
});

test("a still tap on a resize grip opens the editor at 900px", async ({ page }) => {
  await openCalendar(page, WIDE);
  const chip = await findSeededChip(page);
  const box = await chip.boundingBox();
  if (!box) throw new Error("the timed chip has no bounding box");

  await tap(page, { x: box.x + box.width / 2, y: box.y + 3 });

  await expect(page.getByRole("textbox", { name: "Task title" })).toHaveValue("Update ID card");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: CHIP_LABEL })).toHaveCount(1);
});
