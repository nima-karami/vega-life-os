import { expect, type Page, test } from "@playwright/test";
import { saveGratitude } from "./helpers/app";
import {
  belowTarget,
  bullseyeTarget,
  centreOf,
  firstUnplacedChip,
  openReview,
  ratingButton,
  unplacedChips,
} from "./helpers/review";

async function mouseDrag(page: Page, ...path: { x: number; y: number }[]) {
  const [from, ...rest] = path;
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (const point of rest) await page.mouse.move(point.x, point.y, { steps: 12 });
  await page.mouse.up();
}

test("dragging a value onto the bull's-eye rates it Fully and saves", async ({ page }) => {
  await openReview(page);
  const { chip, valueName } = await firstUnplacedChip(page);

  await mouseDrag(page, await centreOf(chip), await centreOf(bullseyeTarget(page)));
  const fully = ratingButton(page, valueName, "Fully");
  await expect(fully).toHaveAttribute("aria-pressed", "true");
  await expect(unplacedChips(page).filter({ hasText: valueName })).toHaveCount(0);

  await page.getByRole("button", { name: /Save reflection/ }).click();
  await expect(page.getByText("Reflection saved")).toBeVisible();
  await page.getByRole("button", { name: "Previous week" }).click();
  await page.getByRole("button", { name: "This week" }).click();
  await expect(ratingButton(page, valueName, "Fully")).toHaveAttribute("aria-pressed", "true");

  await bullseyeTarget(page).evaluate((el) => el.scrollIntoView({ block: "center" }));
  const dot = bullseyeTarget(page).locator("g").first();
  await mouseDrag(page, await centreOf(dot), await belowTarget(page));
  await expect(ratingButton(page, valueName, "Fully")).toHaveAttribute("aria-pressed", "false");
  await expect(unplacedChips(page).filter({ hasText: valueName })).toHaveCount(1);
});

test("dropping outside the target leaves the value unrated", async ({ page }) => {
  await openReview(page);
  const { chip, valueName } = await firstUnplacedChip(page);

  await mouseDrag(
    page,
    await centreOf(chip),
    await centreOf(bullseyeTarget(page)),
    await belowTarget(page),
  );
  await expect(unplacedChips(page).filter({ hasText: valueName })).toHaveCount(1);
  for (const label of ["Not really", "A little", "Somewhat", "Mostly", "Fully"])
    await expect(ratingButton(page, valueName, label)).toHaveAttribute("aria-pressed", "false");
});

test("tap a value, then a ring, and the buttons stay in step", async ({ page }) => {
  await openReview(page);
  const { chip, valueName } = await firstUnplacedChip(page);

  await chip.click();
  await expect(chip).toHaveAttribute("aria-pressed", "true");
  await bullseyeTarget(page).click();
  await expect(ratingButton(page, valueName, "Fully")).toHaveAttribute("aria-pressed", "true");

  await ratingButton(page, valueName, "A little").click();
  await expect(ratingButton(page, valueName, "A little")).toHaveAttribute("aria-pressed", "true");
  await expect(ratingButton(page, valueName, "Fully")).toHaveAttribute("aria-pressed", "false");
});

test("the gratitude recap appears only for a week with gratitude", async ({ page }) => {
  await openReview(page);
  const recap = page.getByRole("region", { name: "Grateful for this week" });
  await expect(recap).toHaveCount(0);

  await page.goto("/today", { waitUntil: "domcontentloaded" });
  await saveGratitude(page);
  await page.goto("/analytics?tab=review", { waitUntil: "domcontentloaded" });
  await expect(recap).toContainText("e2e gratitude");

  await page.getByRole("button", { name: "Next week" }).click();
  await expect(recap).toHaveCount(0);
});
