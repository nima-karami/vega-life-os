import { expect } from "@playwright/test";
import { test } from "./fixtures";
import {
  belowTarget,
  bullseyeTarget,
  centreOf,
  firstUnplacedChip,
  openReview,
  ratingButton,
  unplacedChips,
} from "./helpers/review";
import { dragAlong, endTouch, startTouch, tap } from "./helpers/touch";

test("a finger drag onto the bull's-eye rates the value Fully", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await openReview(page);
  const target = bullseyeTarget(page);
  await target.scrollIntoViewIfNeeded();
  const targetBox = await target.boundingBox();
  expect(targetBox?.width ?? 0).toBeGreaterThanOrEqual(280);
  const pageOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(pageOverflow).toBeLessThanOrEqual(0);

  const { chip, valueName } = await firstUnplacedChip(page);
  const from = await centreOf(chip);
  await startTouch(page, from);
  await dragAlong(page, { from, to: await centreOf(target), durationMs: 300, steps: 12 });
  await endTouch(page);
  await expect(ratingButton(page, valueName, "Fully")).toHaveAttribute("aria-pressed", "true");
});

test("dragging a placed dot off the target returns it to the tray unrated", async ({ page }) => {
  await openReview(page);
  const { chip, valueName } = await firstUnplacedChip(page);
  const target = bullseyeTarget(page);
  await tap(page, await centreOf(chip));
  await tap(page, await centreOf(target));
  await expect(ratingButton(page, valueName, "Fully")).toHaveAttribute("aria-pressed", "true");
  await expect(unplacedChips(page).filter({ hasText: valueName })).toHaveCount(0);

  const dot = await centreOf(target.locator("g").first());
  await startTouch(page, dot);
  await dragAlong(page, { from: dot, to: await belowTarget(page), durationMs: 300, steps: 12 });
  await endTouch(page);
  await expect(unplacedChips(page).filter({ hasText: valueName })).toHaveCount(1);
  await expect(ratingButton(page, valueName, "Fully")).toHaveAttribute("aria-pressed", "false");
});
