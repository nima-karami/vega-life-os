import { expect, type Locator, type Page } from "@playwright/test";
import { enterApp, turnQuietModeOff } from "./app";

/** The review lives under Analytics, which quiet mode hides — these specs turn it off first. */
export async function openReview(page: Page) {
  await turnQuietModeOff(page);
  await enterApp(page);
  await page.goto("/analytics?tab=review", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("How consistently did you live each value this week?")).toBeVisible({
    timeout: 15_000,
  });
}

export const bullseyeTarget = (page: Page) => page.getByRole("img", { name: "Value target" });

export const unplacedChips = (page: Page) =>
  page.getByRole("group", { name: "Not yet placed" }).getByRole("button");

export const ratingButton = (page: Page, valueName: string, label: string) =>
  page.getByRole("group", { name: valueName, exact: true }).getByRole("button", { name: label });

export async function centreOf(locator: Locator): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox();
  if (box === null) throw new Error("no bounding box");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** A point straight below the target, past its outer ring. */
export async function belowTarget(page: Page): Promise<{ x: number; y: number }> {
  const box = await bullseyeTarget(page).boundingBox();
  if (box === null) throw new Error("no bounding box");
  return { x: box.x + box.width / 2, y: box.y + box.height + 12 };
}

/** The first unplaced value, scrolled so it and the target share the viewport. */
export async function firstUnplacedChip(page: Page): Promise<{ chip: Locator; valueName: string }> {
  const chip = unplacedChips(page).first();
  await bullseyeTarget(page)
    .locator("xpath=../..")
    .evaluate((el) => el.scrollIntoView({ block: "center" }));
  return { chip, valueName: (await chip.innerText()).trim() };
}
