import { expect, type Page, test } from "@playwright/test";
import {
  cancelTouch,
  dragAlong,
  endTouch,
  longPress,
  moveTouch,
  penDrag,
  startTouch,
  swipe,
  tap,
} from "./helpers/touch";

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
async function openSeededChipDay(page: Page, viewport = PHONE) {
  await openCalendar(page, viewport);
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

const armed = (page: Page) => page.locator('[data-armed="true"]');

// The centre of the seeded chip — every armed gesture starts from the body.
async function chipCentre(page: Page) {
  const box = await (await findSeededChip(page)).boundingBox();
  if (!box) throw new Error("the timed chip has no bounding box");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** The first hold arms and opens nothing; the menu is a second gesture on the armed chip. */
async function armSeededChip(page: Page) {
  const centre = await chipCentre(page);
  await longPress(page, centre);
  await expect(armed(page)).toHaveCount(1);
  await expect(page.getByRole("menu")).toHaveCount(0);
  return centre;
}

// A pen that aims like a finger earns the finger's route to the menu, scrim and all —
// the half of the rule the resize tests below cannot see. Two holds, like a finger's.
test("a pen long press on a timed chip opens its menu at phone width", async ({ page }) => {
  await openSeededChipDay(page);
  const at = await chipCentre(page);

  await penDrag(page, { from: at, to: at, durationMs: 700, steps: 7 });

  await expect(armed(page)).toHaveCount(1);
  await expect(page.getByRole("menu")).toHaveCount(0);

  await penDrag(page, { from: at, to: at, durationMs: 700, steps: 7 });

  await expect(page.getByRole("menu")).toBeVisible();
  await expect(page.locator("[data-menu-scrim]")).toHaveCount(1);
  await expect(page.getByRole("textbox", { name: "Task title" })).toHaveCount(0);
});

test("a long press on a timed chip arms it and opens no menu", async ({ page }) => {
  await openSeededChipDay(page);
  const centre = await chipCentre(page);

  await longPress(page, centre);

  await expect(armed(page)).toHaveCount(1);
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(page.getByRole("button", { name: CHIP_LABEL })).toHaveCount(1);
});

test("a long press on a timed chip opens its menu and leaves the time alone", async ({ page }) => {
  await openSeededChipDay(page);
  const centre = await armSeededChip(page);

  await longPress(page, centre);

  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  for (const item of ["Copy", "Unschedule", "Delete"]) {
    await expect(menu.getByRole("menuitem", { name: item })).toBeVisible();
  }
  await expect(armed(page)).toHaveCount(1);
  await expect(page.getByRole("button", { name: CHIP_LABEL })).toHaveCount(1);
});

test("an armed chip moves when its body is swiped", async ({ page }) => {
  await openSeededChipDay(page);
  const centre = await armSeededChip(page);

  await swipe(page, {
    from: centre,
    to: { x: centre.x, y: centre.y + 46 },
    durationMs: 300,
    steps: 12,
  });

  await expect(armed(page)).toHaveCount(1);
  await expect(page.getByRole("button", { name: /^Update ID card, 14:00–15:00/ })).toBeVisible();
});

// 8px is about ten minutes, so the write proves the 15-minute snap, not the raw pointer.
test("an armed body drag snaps to the quarter hour", async ({ page }) => {
  await openSeededChipDay(page);
  const centre = await armSeededChip(page);

  await swipe(page, {
    from: centre,
    to: { x: centre.x, y: centre.y + 8 },
    durationMs: 200,
    steps: 8,
  });

  await expect(page.getByRole("button", { name: /^Update ID card, 13:15–14:15/ })).toBeVisible();
});

test("a tap on an armed chip opens the editor and disarms", async ({ page }) => {
  await openSeededChipDay(page);
  const centre = await armSeededChip(page);

  await tap(page, centre);

  await expect(page.getByRole("textbox", { name: "Task title" })).toHaveValue("Update ID card");
  await page.keyboard.press("Escape");
  await expect(armed(page)).toHaveCount(0);
});

// The window listeners are shared, so only the pointer that started the drag may end it —
// this is what the dropped `{ once: true }` on pointerup would otherwise break. The second
// finger lands on the armed chip itself, the one place it does not also trip disarm edge 1.
test("a second finger on the armed chip neither drives nor ends its drag", async ({ page }) => {
  await openSeededChipDay(page);
  const centre = await armSeededChip(page);

  await startTouch(page, { ...centre, id: 1 });
  const held = { x: centre.x, y: centre.y + 46, id: 1 };
  await dragAlong(page, { from: { ...centre, id: 1 }, to: held, durationMs: 250, steps: 10 });
  // On the chip where it now sits, not where it started — a finger off it is edge 1.
  const second = { x: centre.x - 30, y: centre.y + 46, id: 2 };
  await startTouch(page, [held, second]);
  await endTouch(page, [second]);
  await expect(page.getByRole("status")).not.toContainText("Moved to");

  await moveTouch(page, [{ x: centre.x, y: centre.y + 92, id: 1 }]);
  await endTouch(page);

  await expect(page.getByRole("button", { name: /^Update ID card, 15:00–16:00/ })).toBeVisible();
  await expect(armed(page)).toHaveCount(1);
});

// The mirror case: a finger landing anywhere else is disarm edge 1, and a disarm cancels the
// live drag rather than letting the other chip's position drive it.
test("a finger landing off the armed chip disarms it and writes nothing", async ({ page }) => {
  await openSeededChipDay(page);
  const centre = await armSeededChip(page);

  await startTouch(page, { ...centre, id: 1 });
  const held = { x: centre.x, y: centre.y + 46, id: 1 };
  await dragAlong(page, { from: { ...centre, id: 1 }, to: held, durationMs: 250, steps: 10 });
  await startTouch(page, [held, { x: centre.x, y: centre.y - 200, id: 2 }]);
  await endTouch(page);

  await expect(armed(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: CHIP_LABEL })).toHaveCount(1);
  await expect(page.getByRole("status")).not.toContainText("Moved to");
});

test("a cancelled armed drag writes nothing and keeps the arm", async ({ page }) => {
  await openSeededChipDay(page);
  const centre = await armSeededChip(page);

  await startTouch(page, centre);
  await dragAlong(page, {
    from: centre,
    to: { x: centre.x, y: centre.y + 46 },
    durationMs: 250,
    steps: 10,
  });
  await cancelTouch(page);

  await expect(armed(page)).toHaveCount(1);
  await expect(page.getByRole("button", { name: CHIP_LABEL })).toHaveCount(1);
  await expect(page.getByRole("status")).not.toContainText("Moved to");
});

test("a tap on empty grid disarms without creating a task", async ({ page }) => {
  await openSeededChipDay(page);
  const centre = await armSeededChip(page);
  const chipsBefore = await page.locator("[data-chip-id]").count();

  await tap(page, { x: centre.x, y: centre.y + 160 });

  await expect(armed(page)).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Task title" })).toHaveCount(0);
  await expect(page.locator("[data-chip-id]")).toHaveCount(chipsBefore);
});

test("Escape disarms an armed chip and leaves its time alone", async ({ page }) => {
  await openSeededChipDay(page);
  await armSeededChip(page);

  await page.keyboard.press("Escape");

  await expect(armed(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: CHIP_LABEL })).toHaveCount(1);
});

test("moving to the next day disarms an armed chip", async ({ page }) => {
  await openSeededChipDay(page);
  await armSeededChip(page);

  await page.getByRole("button", { name: "Next day" }).click();

  await expect(armed(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Previous day" }).click();
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

// The touchscreen-laptop band: past sm the pointer is still only a finger, so the body
// owes the same two guarantees the phone gets — a swipe writes nothing, a hold opens the menu.
test("a swipe on the chip body writes nothing at 900px", async ({ page }) => {
  await openCalendar(page, WIDE);
  const chip = await findSeededChip(page);
  const box = await chip.boundingBox();
  if (!box) throw new Error("the timed chip has no bounding box");
  const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  expect(await maxScrollTop(page), "the grid is already scrolled before the swipe").toBe(0);

  await startTouch(page, from);
  await dragAlong(page, { from, to: { x: from.x, y: from.y - 200 }, durationMs: 350, steps: 12 });
  await endTouch(page);

  await expect
    .poll(() => maxScrollTop(page), { message: "the swipe did not scroll the grid" })
    .toBeGreaterThan(0);
  await expect(page.getByRole("button", { name: CHIP_LABEL })).toHaveCount(1);
  await expect(page.getByRole("status")).not.toContainText("Moved to");
});

// A finger is a touch source at every width, so 900px arms on the first hold too.
test("a long press on the chip body opens its menu at 900px", async ({ page }) => {
  await openCalendar(page, WIDE);
  const centre = await armSeededChip(page);

  await longPress(page, centre);

  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  for (const item of ["Copy", "Unschedule", "Delete"]) {
    await expect(menu.getByRole("menuitem", { name: item })).toBeVisible();
  }
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

// Past sm the pen is a mouse, so a hold arms no long press — otherwise the menu it opens
// mid-gesture abandons the resize the grip test below depends on. The editor on release is
// the positive control: the press really did land on the chip.
test("a pen hold on the chip body opens no menu at 900px", async ({ page }) => {
  await openCalendar(page, WIDE);
  const chip = await findSeededChip(page);
  const box = await chip.boundingBox();
  if (!box) throw new Error("the timed chip has no bounding box");
  const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

  await penDrag(page, { from: at, to: at, durationMs: 700, steps: 7 });

  await expect(page.getByRole("textbox", { name: "Task title" })).toHaveValue("Update ID card");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(page.locator("[data-menu-scrim]")).toHaveCount(0);
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

// A touchscreen laptop still has a mouse, and only the mouse branch of the grip guard
// keeps desktop resize alive — nothing else in the suite drives one.
test("a mouse drag on the top grip resizes the chip at 900px", async ({ page }) => {
  await openCalendar(page, WIDE);
  const chip = await findSeededChip(page);
  const box = await chip.boundingBox();
  if (!box) throw new Error("the timed chip has no bounding box");
  const grip = { x: box.x + box.width / 2, y: box.y + 3 };

  await page.mouse.move(grip.x, grip.y);
  await page.mouse.down();
  await page.mouse.move(grip.x, grip.y - 92, { steps: 12 });
  await page.mouse.up();

  await expect(page.getByRole("button", { name: /^Update ID card, 11:00–14:00/ })).toBeVisible();
});

// The pixels either side of the breakpoint: the widest single-day column still covers the
// week column the chip lands in, so a release can stay on the chip across the swap.
const LAST_COMPACT = { width: 639, height: 844 };
const FIRST_WEEK = { width: 640, height: 844 };

async function chipBox(page: Page) {
  const box = await (await findSeededChip(page)).boundingBox();
  if (!box) throw new Error("the timed chip has no bounding box");
  return box;
}

// Crossing sm swaps the columns under the finger, so the remembered press must die with them.
test("a chip press held across the breakpoint opens nothing on release", async ({ page }) => {
  await openSeededChipDay(page, LAST_COMPACT);
  await page.setViewportSize(FIRST_WEEK);
  const weekBox = await chipBox(page);
  await page.setViewportSize(LAST_COMPACT);
  const phoneBox = await chipBox(page);
  const editorTitle = page.getByRole("textbox", { name: "Task title" });

  // Where the chip covers itself in both layouts, so the release cannot land on an empty slot.
  const left = Math.max(phoneBox.x, weekBox.x);
  const right = Math.min(phoneBox.x + phoneBox.width, weekBox.x + weekBox.width);
  const top = Math.max(phoneBox.y, weekBox.y);
  const bottom = Math.min(phoneBox.y + phoneBox.height, weekBox.y + weekBox.height);
  expect(right - left, "no horizontal chip overlap across sm").toBeGreaterThan(8);
  expect(bottom - top, "no vertical chip overlap across sm").toBeGreaterThan(8);
  const press = { x: (left + right) / 2, y: (top + bottom) / 2 };

  // A still tap first, so the negative below cannot pass on a press that reaches nothing.
  await tap(page, press);
  await expect(editorTitle).toHaveValue("Update ID card");
  await page.keyboard.press("Escape");
  await expect(editorTitle).toHaveCount(0);

  await startTouch(page, press);
  await page.setViewportSize(FIRST_WEEK);
  await endTouch(page);

  await expect(editorTitle).toHaveCount(0);
  await expect(page.getByRole("button", { name: CHIP_LABEL })).toHaveCount(1);
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
