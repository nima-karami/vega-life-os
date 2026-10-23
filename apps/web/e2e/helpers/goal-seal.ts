import { expect, type Page, test } from "@playwright/test";
import { enterApp } from "./app";
import { countOf, readMotion, recordMotion } from "./motion-log";

/** The sample sandbox's active goal under Courage. */
const GOAL_HREF = "/goals/g1";
const SEALED_CLIP = "circle(75% at 50% 50%)";
const OPEN_CLIP = "circle(0% at 50% 50%)";

const disc = (page: Page) => page.locator(".goal-seal");
const flood = (page: Page) => page.locator(".goal-seal__flood");
const statusButton = (page: Page, label: string) =>
  page.getByRole("button", { name: label, exact: true });
const chip = (page: Page) => page.locator(".goal-status-chip__label:not([data-leaving])");

/** The whole chip, label and stack, as the meta row lays it out. */
async function chipWidth(page: Page): Promise<number> {
  const box = await page.locator(".goal-status-chip").boundingBox();
  if (!box) throw new Error("status chip has no box");
  return box.width;
}

async function openGoal(page: Page) {
  await page.goto("/values");
  await page.locator(`main a[href="${GOAL_HREF}"]`).first().click();
  await expect(page).toHaveURL(new RegExp(`${GOAL_HREF}$`));
  await expect(statusButton(page, "Done")).toBeVisible();
  await expect(disc(page)).not.toHaveAttribute("data-sealed");
}

/** Goal reached · Seal: the header disc floods with the value's swatch on Status → Done. */
export function describeGoalSeal() {
  test.beforeEach(async ({ page }) => {
    await recordMotion(page);
    await enterApp(page);
  });

  test("Done seals the disc once; a reload shows it sealed without replaying", async ({ page }) => {
    await openGoal(page);
    await statusButton(page, "Done").click();
    await expect(disc(page)).toHaveAttribute("data-anim", "seal");
    await expect(disc(page)).toHaveAttribute("data-sealed");
    await statusButton(page, "Done").click();

    await expect(disc(page)).not.toHaveAttribute("data-anim");
    await expect(flood(page)).toHaveCSS("clip-path", SEALED_CLIP);
    await expect(chip(page)).toHaveText("Done");
    const { animations } = await readMotion(page);
    expect(countOf(animations, "goal-seal-pop")).toBe(1);
    expect(countOf(animations, "goal-seal-halo")).toBe(1);
    expect(countOf(animations, "goal-chip-in-up")).toBe(1);

    await page.reload();
    await expect(disc(page)).toHaveAttribute("data-sealed", { timeout: 20_000 });
    await expect(disc(page)).not.toHaveAttribute("data-anim");
    await expect(flood(page)).toHaveCSS("clip-path", SEALED_CLIP);
    expect((await readMotion(page)).animations).not.toContain("goal-seal-pop");
  });

  test("the chip is Done's own width once the beat ends, the same as after a reload", async ({
    page,
  }) => {
    await openGoal(page);
    await statusButton(page, "Backlog").click();
    await expect(chip(page)).toHaveText("Backlog");
    await statusButton(page, "Done").click();
    await expect(disc(page)).toHaveAttribute("data-anim", "seal");
    await expect(disc(page)).not.toHaveAttribute("data-anim");
    await expect(page.locator(".goal-status-chip__label")).toHaveCount(1);
    const settledWidth = await chipWidth(page);

    await page.reload();
    await expect(disc(page)).toHaveAttribute("data-sealed", { timeout: 20_000 });
    expect(await chipWidth(page)).toBe(settledWidth);
  });

  test("moving a done goal back to Active drains the flood", async ({ page }) => {
    await openGoal(page);
    await statusButton(page, "Done").click();
    await expect(disc(page)).not.toHaveAttribute("data-anim");

    await statusButton(page, "Active").click();
    await expect(disc(page)).toHaveAttribute("data-anim", "unseal");
    await expect(disc(page)).not.toHaveAttribute("data-sealed");
    await expect(disc(page)).not.toHaveAttribute("data-anim");
    await expect(flood(page)).toHaveCSS("clip-path", OPEN_CLIP);
    await expect(chip(page)).toHaveText("Active");
  });

  test("under reduced motion the flood is a fade: no pop, no halo, no clip", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openGoal(page);
    await statusButton(page, "Done").click();

    await expect(disc(page)).not.toHaveAttribute("data-anim");
    await expect(flood(page)).toHaveCSS("opacity", "1");
    await expect(flood(page)).toHaveCSS("clip-path", "none");
    await expect(chip(page)).toHaveText("Done");
    const { animations, transitions } = await readMotion(page);
    expect(animations).not.toContain("goal-seal-pop");
    expect(animations).not.toContain("goal-seal-halo");
    expect(animations).not.toContain("goal-chip-in-up");
    expect(animations).toContain("goal-chip-fade-in");
    expect(transitions).toContain("goal-seal__flood|opacity");
    expect(transitions).not.toContain("goal-seal__flood|clip-path");
  });
}
