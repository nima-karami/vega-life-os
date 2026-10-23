import { expect, type Page, test } from "@playwright/test";
import {
  type BootFrame,
  delayAppBundle,
  readBootTrace,
  scaleSplashClock,
  traceBootSplash,
} from "./helpers/boot";
import { failOnPageErrors } from "./helpers/page-errors";

/**
 * The index.html boot splash: grace, stroke mark, "Live your values" dwell, slow-load
 * status line, hand-off. Every time below is on the splash's own animation clock, read
 * frame by frame, so a loaded machine shifts when frames land, never what they show.
 */

failOnPageErrors();

const FRAME_SLACK_MS = 50;
const explore = (page: Page) => page.getByRole("button", { name: /explore with sample data/i });

const timeOf = (frames: BootFrame[], matches: (frame: BootFrame) => boolean) => {
  const frame = frames.find((candidate) => candidate.splashTime !== null && matches(candidate));
  if (!frame?.splashTime) throw new Error("no traced frame matched");
  return frame.splashTime;
};
const isOut = (frame: BootFrame) => frame.state.split(" ").includes("out");
const isReturn = (frame: BootFrame) => frame.state.split(" ").includes("return");
const beforeOut = (frames: BootFrame[]) => frames.slice(0, frames.findIndex(isOut));

async function expectAppUsable(page: Page) {
  await explore(page).click();
  await expect(page.locator("main")).toBeVisible();
}

test("a load ready inside the 300ms grace never paints the splash", async ({ page }) => {
  // At 1/50 speed a seconds-long dev boot is still inside the splash's 300ms grace.
  await scaleSplashClock(page, 0.02);
  await traceBootSplash(page);
  await page.goto("/");
  const { frames } = await readBootTrace(page);

  const painted = frames.filter((frame) => !frame.isGone);
  expect(painted.every((frame) => frame.tileOpacity === 0 && frame.tagOpacity === 0)).toBe(true);
  expect(frames.some(isOut)).toBe(false);
  expect(frames.some((frame) => frame.rootClass.includes("boot-app-fast"))).toBe(true);
  expect(frames.some((frame) => frame.rootClass.includes("boot-app-in"))).toBe(false);
  await expectAppUsable(page);
});

test("a typical load draws the mark, dwells on the tagline for 600ms, then hands off", async ({
  page,
}) => {
  // A ~1-4s dev boot at quarter speed lands ready between the grace and the end of the dwell.
  await delayAppBundle(page, 1000);
  await scaleSplashClock(page, 0.25);
  await traceBootSplash(page);
  await page.goto("/");
  const { frames } = await readBootTrace(page);

  const tagStart = timeOf(frames, (frame) => frame.tagOpacity > 0);
  const outStart = timeOf(frames, isOut);
  expect(tagStart).toBeGreaterThanOrEqual(640);
  expect(outStart).toBeGreaterThanOrEqual(1240 - FRAME_SLACK_MS);
  expect(outStart - tagStart).toBeGreaterThanOrEqual(600 - FRAME_SLACK_MS);
  const shown = beforeOut(frames);
  expect(shown.some((frame) => frame.tileOpacity === 1 && frame.strokeOffset === "0px")).toBe(true);
  expect(shown.some((frame) => frame.tagOpacity === 1)).toBe(true);
  expect(shown.some((frame) => frame.statusOpacity > 0)).toBe(false);
  expect(frames.some(isReturn)).toBe(false);
  expect(frames.some((frame) => frame.rootClass.includes("boot-app-in"))).toBe(true);
  await expectAppUsable(page);
});

test("a slow load swaps in the status line, then brings the tagline back before hand-off", async ({
  page,
}) => {
  await delayAppBundle(page, 3600);
  await traceBootSplash(page);
  await page.goto("/");
  const { frames } = await readBootTrace(page);

  const statusShown = frames.filter((frame) => frame.statusOpacity === 1 && !isReturn(frame));
  expect(statusShown.length).toBeGreaterThan(0);
  expect(statusShown.every((frame) => frame.tagOpacity === 0)).toBe(true);
  expect(timeOf(frames, (frame) => frame.statusOpacity > 0)).toBeGreaterThanOrEqual(3160);

  const returnStart = timeOf(frames, isReturn);
  const outStart = timeOf(frames, isOut);
  expect(outStart - returnStart).toBeGreaterThanOrEqual(720 - FRAME_SLACK_MS);
  const lastBeforeOut = beforeOut(frames).at(-1);
  expect(lastBeforeOut?.tagOpacity).toBe(1);
  expect(lastBeforeOut?.statusOpacity).toBe(0);
  expect(lastBeforeOut?.tagTransform).toBe("none");
  await expectAppUsable(page);
});

test("reduced motion fades every beat in place and keeps the dwell", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await delayAppBundle(page, 1000);
  await scaleSplashClock(page, 0.25);
  await traceBootSplash(page);
  await page.goto("/");
  const { frames } = await readBootTrace(page);

  const painted = frames.filter((frame) => !frame.isGone);
  expect(painted.every((frame) => frame.strokeOffset === "0px")).toBe(true);
  expect(painted.every((frame) => frame.tileTransform === "none")).toBe(true);
  expect(painted.every((frame) => frame.tagTransform === "none")).toBe(true);
  expect(timeOf(frames, (frame) => frame.tagOpacity > 0)).toBeGreaterThanOrEqual(640);
  expect(timeOf(frames, isOut)).toBeGreaterThanOrEqual(1240 - FRAME_SLACK_MS);
  expect(beforeOut(frames).some((frame) => frame.tagOpacity === 1)).toBe(true);
  await expectAppUsable(page);
});

test("a tap during the dwell skips straight to the hand-off without reaching the app", async ({
  page,
}) => {
  // The slow path's dwell is a fixed 720ms after ready, so the tap lands inside it every time.
  await delayAppBundle(page, 3200);
  await traceBootSplash(page);
  await page.goto("/");
  await expect(page.locator("#boot[data-state='return']")).toBeAttached({ timeout: 15_000 });
  await page.mouse.click(200, 200);
  const { frames, tapTime } = await readBootTrace(page);

  const returnStart = timeOf(frames, isReturn);
  const outStart = timeOf(frames, isOut);
  expect(tapTime).not.toBeNull();
  expect(tapTime ?? 0).toBeLessThan(returnStart + 720);
  expect(outStart - (tapTime ?? 0)).toBeLessThanOrEqual(FRAME_SLACK_MS);
  await expect(explore(page)).toBeVisible();
  await expectAppUsable(page);
});
