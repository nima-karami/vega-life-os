import { expect, type Page } from "@playwright/test";
import { test } from "./fixtures";
import { skipGratitudePage } from "./helpers/app";
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
 * Touch safety for the calendar's timed grid (local spec
 * docs/specs/2026-09-04-calendar-touch.md): a finger scrolls, it never reschedules.
 * Both widths run here — a touchscreen laptop is past `sm` and still has only fingers.
 */

const PHONE = { width: 390, height: 844 };
const WIDE = { width: 900, height: 900 };
// Both ends of the range, so one read covers the start time and the duration.
const CHIP_LABEL = /^Update ID card, 13:00 to 14:00/;

async function openCalendar(page: Page, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport);
  await skipGratitudePage(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const explore = page.getByRole("button", { name: /explore with sample data/i });
  const main = page.locator("main");
  await expect(explore.or(main)).toBeVisible({ timeout: 20_000 });
  if (await explore.isVisible().catch(() => false)) {
    await explore.click();
    await expect(main).toBeVisible({ timeout: 15_000 });
  }
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
async function openThursday(page: Page) {
  await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });
  await page
    .locator("main button")
    .filter({ hasText: /^Thu\d{2}$/ })
    .first()
    .click();
}

async function openSeededChipDay(page: Page, viewport = PHONE) {
  await openCalendar(page, viewport);
  await openThursday(page);
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

/**
 * The timed grid's own scroller is ScrollShadow's inner node, which the page exposes no handle
 * for — walk up from the seeded chip. `HOUR_PX` is 46 and the window opens at 05:00, so the
 * hour at its bottom edge follows from `scrollTop`.
 */
async function measureTimedScroller(page: Page) {
  // Matched loosely: after a move the chip no longer carries its seeded range.
  return page.getByRole("button", { name: /^Update ID card, / }).evaluate((el) => {
    for (let node = el.parentElement; node; node = node.parentElement) {
      const overflowY = getComputedStyle(node).overflowY;
      if (
        (overflowY === "auto" || overflowY === "scroll") &&
        node.scrollHeight > node.clientHeight
      ) {
        const box = node.getBoundingClientRect();
        return {
          bottom: box.bottom,
          scrollTop: node.scrollTop,
          bottomVisibleMinute: 5 * 60 + ((node.scrollTop + node.clientHeight) / 46) * 60,
        };
      }
    }
    throw new Error("the timed grid has no scroller");
  });
}

/**
 * Parks the chip 120px inside the scroller, clear of both auto-scroll edge bands. Without it a
 * 92px drag from wherever `scrollIntoViewIfNeeded` left the chip ends inside the bottom band and
 * keeps sliding while the finger rests there — real behaviour, but not what these tests measure.
 */
async function parkChipClearOfEdges(page: Page) {
  const chip = await findSeededChip(page);
  await chip.evaluate((el) => {
    for (let node = el.parentElement; node; node = node.parentElement) {
      const overflowY = getComputedStyle(node).overflowY;
      if (
        (overflowY === "auto" || overflowY === "scroll") &&
        node.scrollHeight > node.clientHeight
      ) {
        node.scrollTop += el.getBoundingClientRect().top - node.getBoundingClientRect().top - 120;
        return;
      }
    }
    throw new Error("the timed grid has no scroller");
  });
}

// The centre of the seeded chip — every armed gesture starts from the body.
async function chipCentre(page: Page) {
  const box = await (await findSeededChip(page)).boundingBox();
  if (!box) throw new Error("the timed chip has no bounding box");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** The first hold arms and opens nothing; the menu is a second gesture on the armed chip. */
async function armSeededChip(page: Page) {
  await parkChipClearOfEdges(page);
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
  await expect(page.locator("[data-chip-handle]")).toHaveCount(2);
  for (const handle of await page.locator("[data-chip-handle]").all()) {
    await expect(handle).toBeVisible();
  }
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(page.getByRole("button", { name: CHIP_LABEL })).toHaveCount(1);
});

/**
 * Grabs an armed chip's resize pill 12px **clear of the chip box**, where nothing but the
 * armed handle can take the press — the shipped 6px grips live inside the button, so an
 * edge-anchored press would resize with or without the handles and prove nothing.
 * `byPx` is the release offset from the chip's visible edge, because `resolveDrag` reads the
 * absolute pointer for top/bottom and ignores where the grab started.
 */
async function dragChipEdge(page: Page, edge: "top" | "bottom", byPx: number) {
  const box = await (await findSeededChip(page)).boundingBox();
  if (!box) throw new Error("the timed chip has no bounding box");
  const anchorY = edge === "top" ? box.y : box.y + box.height;
  const x = box.x + box.width / 2;
  const from = { x, y: anchorY + (edge === "top" ? -12 : 12) };
  await swipe(page, { from, to: { x, y: anchorY + byPx }, durationMs: 300, steps: 12 });
}

test("dragging an armed chip's bottom handle lengthens it", async ({ page }) => {
  await openSeededChipDay(page);
  await armSeededChip(page);

  await dragChipEdge(page, "bottom", 46);

  await expect(page.getByRole("button", { name: /^Update ID card, 13:00 to 15:00/ })).toBeVisible();
  await expect(armed(page)).toHaveCount(1);
});

test("dragging an armed chip's top handle moves its start and pins its end", async ({ page }) => {
  await openSeededChipDay(page);
  await armSeededChip(page);

  await dragChipEdge(page, "top", -46);

  await expect(page.getByRole("button", { name: /^Update ID card, 12:00 to 14:00/ })).toBeVisible();
  await expect(armed(page)).toHaveCount(1);
});

test("a bottom handle dragged past the start floors at one snap step", async ({ page }) => {
  await openSeededChipDay(page);
  await armSeededChip(page);

  await dragChipEdge(page, "bottom", -200);

  await expect(page.getByRole("button", { name: /^Update ID card, 13:00 to 13:15/ })).toBeVisible();
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

// The single-gesture path: the hold arms without lifting and the same finger keeps dragging,
// which only survives because the chip blocks `touchmove` once the drag is live. 92px is two
// hour rows, so 13:00 walks forward to 15:00.
test("a hold that keeps dragging moves the chip in one gesture", async ({ page }) => {
  await openSeededChipDay(page);
  await parkChipClearOfEdges(page);
  const centre = await chipCentre(page);

  await startTouch(page, centre);
  await page.waitForTimeout(620);
  await dragAlong(page, {
    from: centre,
    to: { x: centre.x, y: centre.y + 92 },
    durationMs: 300,
    steps: 12,
  });
  await endTouch(page);

  await expect(armed(page)).toHaveCount(1);
  await expect(page.getByRole("status")).toContainText("Moved to");
  await expect(page.getByRole("button", { name: /^Update ID card, 15:00 to 16:00/ })).toBeVisible();
  await page.reload({ waitUntil: "domcontentloaded" });
  await openThursday(page);
  await expect(page.getByRole("button", { name: /^Update ID card, 15:00 to 16:00/ })).toBeVisible({
    timeout: 15_000,
  });
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
  await expect(page.getByRole("button", { name: /^Update ID card, 14:00 to 15:00/ })).toBeVisible();
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

  await expect(page.getByRole("button", { name: /^Update ID card, 13:15 to 14:15/ })).toBeVisible();
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

  await expect(page.getByRole("button", { name: /^Update ID card, 15:00 to 16:00/ })).toBeVisible();
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

const startMinuteOf = async (page: Page) => {
  const label = await page
    .getByRole("button", { name: /^Update ID card, / })
    .getAttribute("aria-label");
  const [, hh, mm] = /(\d{2}):(\d{2})/.exec(label ?? "") ?? [];
  return Number(hh) * 60 + Number(mm);
};

test("an armed drag held at the bottom edge scrolls the grid and lands past it", async ({
  page,
}) => {
  await openSeededChipDay(page);
  const centre = await armSeededChip(page);
  // The grid is 874px inside a ~480px viewport, so without auto-scroll a move cannot leave the
  // hours already on screen.
  const before = await measureTimedScroller(page);

  // 20px inside the scroller's bottom edge band, where the rate curve is near its ceiling.
  const band = { x: centre.x, y: before.bottom - 20 };
  await startTouch(page, centre);
  await dragAlong(page, { from: centre, to: band, durationMs: 250, steps: 10 });
  // The hold is the point: a resting finger emits no pointermove, so only an rAF loop scrolls.
  await page.waitForTimeout(700);
  await moveTouch(page, band);
  await endTouch(page);

  const after = await measureTimedScroller(page);
  expect(after.scrollTop, "the held drag did not scroll the grid").toBeGreaterThan(
    before.scrollTop,
  );
  expect(
    await startMinuteOf(page),
    "the chip never left the hours visible at drag start",
  ).toBeGreaterThan(before.bottomVisibleMinute);
  await expect(armed(page)).toHaveCount(1);
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

// The lift is the arm's only standing signal. `cx` is not tailwind-merge, so the base
// `shadow-sm` outlived every heavier shadow the armed chip added, and it never rendered.
test("an armed chip lifts onto a heavier shadow", async ({ page }) => {
  const chip = await openSeededChipDay(page);
  const resting = await chip.evaluate((el) => getComputedStyle(el).boxShadow);
  expect(resting, "the resting chip is not on shadow-sm").toContain("0px 1px 3px 0px");

  await armSeededChip(page);

  const lifted = await chip.evaluate((el) => getComputedStyle(el).boxShadow);
  expect(lifted, "the armed chip did not lift onto shadow-md").toContain("0px 4px 6px -1px");
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

  await expect(page.getByRole("button", { name: /^Update ID card, 11:00 to 14:00/ })).toBeVisible();
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

  await expect(page.getByRole("button", { name: /^Update ID card, 11:00 to 14:00/ })).toBeVisible();
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

// `chipPressSourceRef` remembers the last press so an Android hold's synthesized `contextmenu`
// can be swallowed. A keyboard-invoked menu carries no press at all, so it must still open.
test("a keyboard context menu opens after a touch press on the chip", async ({ page }) => {
  const chip = await openSeededChipDay(page);
  const centre = await chipCentre(page);

  await startTouch(page, centre);
  await cancelTouch(page);

  await chip.focus();
  await page.keyboard.press("ContextMenu");

  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Delete" })).toBeVisible();
});

// Disarm edge 10 holds during the hold window too: a mouse arriving mid-hold returns the
// surface to the desktop contract, so the finger still resting on the chip never arms it.
test("a mouse press during the hold window stops the chip arming", async ({ page }) => {
  await openSeededChipDay(page);
  await parkChipClearOfEdges(page);
  const centre = await chipCentre(page);

  await startTouch(page, centre);
  await page.mouse.move(8, centre.y);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(700);
  await endTouch(page);

  await expect(armed(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: CHIP_LABEL })).toHaveCount(1);
});

// ─── Day navigation: literal steps, and the two doors back to today ──────────
//
// A day step moves exactly one day, both ways, even when the target week holds today.
// Each of the two step tests is degenerate on exactly one weekday (Monday for the
// forward one, Sunday for the back one) and the pair never degenerates together.

const dayChips = (page: Page) => page.locator("main button").filter({ hasText: /^\w{3}\d{2}$/ });
const dayHeading = (page: Page) => page.getByRole("heading", { level: 1 });
const prevDay = (page: Page) => page.getByRole("button", { name: "Previous day" });
const nextDay = (page: Page) => page.getByRole("button", { name: "Next day" });

/** Which of the strip's seven chips the grid is showing — Monday is 0. */
async function readActiveDay(page: Page) {
  const flags = await dayChips(page).evaluateAll((chips) =>
    chips.map((chip) => chip.getAttribute("aria-current")),
  );
  return flags.indexOf("date");
}

/** Steps back to the Sunday before this week, whatever weekday today is. */
async function openLastWeeksSunday(page: Page) {
  const todayIndex = await readActiveDay(page);
  for (let step = 0; step <= todayIndex; step += 1) await prevDay(page).click();
  await expect.poll(() => readActiveDay(page)).toBe(6);
}

/** Steps forward to the Monday after this week, whatever weekday today is. */
async function openNextWeeksMonday(page: Page) {
  const todayIndex = await readActiveDay(page);
  for (let step = todayIndex; step < 7; step += 1) await nextDay(page).click();
  await expect.poll(() => readActiveDay(page)).toBe(0);
}

test("next day from last week's Sunday lands on this week's Monday", async ({ page }) => {
  await openCalendar(page, PHONE);
  await openLastWeeksSunday(page);

  await nextDay(page).click();

  await expect.poll(() => readActiveDay(page)).toBe(0);
  await expect(dayHeading(page)).toContainText("Mon");
});

test("previous day from next week's Monday lands on this week's Sunday", async ({ page }) => {
  await openCalendar(page, PHONE);
  await openNextWeeksMonday(page);

  await prevDay(page).click();

  await expect.poll(() => readActiveDay(page)).toBe(6);
  await expect(dayHeading(page)).toContainText("Sun");
});

test("the Today button comes back to today's own day", async ({ page }) => {
  await openCalendar(page, PHONE);
  const today = await dayHeading(page).textContent();
  await openLastWeeksSunday(page);

  await page.locator("main header").getByRole("button", { name: "Today", exact: true }).click();

  await expect(dayHeading(page)).toHaveText(today ?? "");
});

test("the command bar's Go to today comes back to today's own day", async ({ page }) => {
  await openCalendar(page, PHONE);
  const today = await dayHeading(page).textContent();
  await openLastWeeksSunday(page);

  await page
    .getByRole("navigation", { name: "Primary" })
    .getByRole("button", { name: "Search" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Command bar" });
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  await page.getByPlaceholder("Search, navigate, or ask…").fill("Go to today");
  await dialog.getByRole("option", { name: "Calendar: Go to today" }).click();

  await expect(dialog).toHaveCount(0);
  await expect(dayHeading(page)).toHaveText(today ?? "");
});
