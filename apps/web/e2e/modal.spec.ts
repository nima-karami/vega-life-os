import { expect, test } from "@playwright/test";

/**
 * Regression guard for the v3 Modal overlay (see fix/v3-modals). The earlier
 * DOM-presence-only checks missed a release-blocking layout bug: the backdrop
 * (react-aria ModalOverlay — the `position:fixed inset-0` centering parent)
 * rendered as an empty sibling of the dialog container, so the dialog fell into
 * static document flow (off-screen / below the fold) and the scrim ate clicks.
 *
 * These assertions are deliberately geometric: the backdrop must be fixed, the
 * dialog's bounding box must sit inside the viewport, and the primary/close
 * button must actually be clickable (not pointer-intercepted) and close the modal.
 */

async function passGratitudeGate(page: import("@playwright/test").Page) {
  const gate = page.getByRole("button", { name: "Continue to today" });
  if (await gate.isVisible().catch(() => false)) {
    await page.getByRole("textbox", { name: "Grateful for, item 1" }).fill("e2e gratitude");
    await gate.click();
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  const explore = page.getByRole("button", { name: /explore with sample data/i });
  const main = page.locator("main");
  await expect(explore.or(main)).toBeVisible({ timeout: 20_000 });
  if (await explore.isVisible().catch(() => false)) {
    await explore.click();
    await expect(main).toBeVisible({ timeout: 15_000 });
  }
});

/** Backdrop is the fixed, full-viewport centering overlay; the dialog sits inside it. */
async function assertOverlayIsFixed(page: import("@playwright/test").Page) {
  const backdrop = page.locator('[data-slot="modal-backdrop"]');
  await expect(backdrop).toBeVisible();
  const position = await backdrop.evaluate((el) => getComputedStyle(el).position);
  expect(position, "modal backdrop must be position:fixed").toBe("fixed");
}

/** The dialog's bounding box must be fully on-screen. */
async function assertDialogOnScreen(page: import("@playwright/test").Page) {
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  const vp = page.viewportSize();
  if (!box || !vp) throw new Error("missing dialog box or viewport size");
  expect(box.x, "dialog left edge off-screen").toBeGreaterThanOrEqual(-1);
  expect(box.y, "dialog top edge off-screen").toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width, "dialog right edge off-screen").toBeLessThanOrEqual(vp.width + 1);
  expect(box.y + box.height, "dialog bottom edge off-screen").toBeLessThanOrEqual(vp.height + 1);
  return { box, vp };
}

test("desktop: confirm modal is centered, on-screen, and its buttons are clickable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await passGratitudeGate(page);
  await page.goto("/settings", { waitUntil: "networkidle" });
  await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Delete all (this device)" }).click();

  await assertOverlayIsFixed(page);
  const { box, vp } = await assertDialogOnScreen(page);

  // Roughly horizontally centered on desktop (dialog midpoint near viewport midpoint).
  const dialogMidX = box.x + box.width / 2;
  expect(Math.abs(dialogMidX - vp.width / 2), "dialog not horizontally centered").toBeLessThan(40);

  // The Cancel control must be genuinely clickable (not intercepted by the scrim)
  // and actually close the modal. A real click is the assertion the old test lacked.
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Cancel" }).click({ timeout: 3000 });
  await expect(dialog).toBeHidden();
});

/** Opens the first habit's page — a tall, scrollable surface — and summons its
 *  delete confirm, the modal that still sits on a long page after the editors
 *  became routes. */
async function openHabitDeleteDialog(page: import("@playwright/test").Page) {
  await page.goto("/habits", { waitUntil: "networkidle" });
  await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });
  await page.locator('main a[href^="/habits/"]').first().click();
  await expect(page.getByRole("textbox", { name: "Habit name" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Delete habit" }).click();
}

test("desktop: a modal stays on-screen even when the page behind is tall", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await passGratitudeGate(page);
  // The habit page is tall and scrollable — the bug pushed the dialog below the fold here.
  await openHabitDeleteDialog(page);

  await assertOverlayIsFixed(page);
  await assertDialogOnScreen(page);

  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Cancel" }).click({ timeout: 3000 });
  await expect(dialog).toBeHidden();
});

test("mobile: modal renders as an on-screen sheet with a clickable action", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 850 });
  await passGratitudeGate(page);
  await openHabitDeleteDialog(page);

  await assertOverlayIsFixed(page);
  const { box, vp } = await assertDialogOnScreen(page);

  // A compact sheet fills (most of) the width.
  expect(box.width, "mobile sheet too narrow").toBeGreaterThan(vp.width * 0.9);

  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Cancel" }).click({ timeout: 3000 });
  await expect(dialog).toBeHidden();
});
