import { expect, type Page } from "@playwright/test";
import { delayAppBundle, scaleSplashClock } from "./boot";

type LayoutFrame = {
  scrollHeight: number;
  clientHeight: number;
  clientWidth: number;
  isSplashUp: boolean;
  rootClass: string;
  appTransform: string;
};

type LayoutTracedWindow = Window & { __layoutFrames?: LayoutFrame[] };

/** Samples the document's scroll extent every frame until the hand-off has settled. */
async function traceDocumentLayout(page: Page) {
  await page.addInitScript(() => {
    const frames: LayoutFrame[] = [];
    (window as LayoutTracedWindow).__layoutFrames = frames;
    let settledFrames = 0;
    const sample = () => {
      const documentRoot = document.documentElement;
      const isSplashUp = !!document.getElementById("boot");
      const appRoot = document.getElementById("root");
      const rootClass = appRoot?.className ?? "";
      const appLayer = appRoot?.firstElementChild;
      frames.push({
        scrollHeight: documentRoot.scrollHeight,
        clientHeight: documentRoot.clientHeight,
        clientWidth: documentRoot.clientWidth,
        isSplashUp,
        rootClass,
        appTransform: appLayer ? getComputedStyle(appLayer).transform : "none",
      });
      const isSettled =
        !isSplashUp && !rootClass.includes("boot-app") && !!document.querySelector("main");
      if (isSettled) settledFrames += 1;
      if (settledFrames < 30 && frames.length < 4000) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
}

async function readLayoutTrace(page: Page): Promise<LayoutFrame[]> {
  await page.waitForFunction(
    () => {
      const frames = (window as LayoutTracedWindow).__layoutFrames ?? [];
      const last = frames.at(-1);
      return (
        frames.length > 30 && !!last && !last.isSplashUp && !last.rootClass.includes("boot-app")
      );
    },
    undefined,
    { timeout: 20_000 },
  );
  return page.evaluate(() => (window as LayoutTracedWindow).__layoutFrames as LayoutFrame[]);
}

/** Opens the sample-data sandbox, then reloads `path` through the full splash hand-off. */
export async function expectRefreshHoldsLayout(page: Page, path: string) {
  await page.goto("/");
  await page.getByRole("button", { name: /explore with sample data/i }).click();
  await expect(page.locator("main")).toBeVisible();

  // Ready lands mid-dwell, so the hand-off plays the full boot-app-in entrance.
  await delayAppBundle(page, 1000);
  await scaleSplashClock(page, 0.25);
  await traceDocumentLayout(page);
  await page.goto(path);
  const frames = await readLayoutTrace(page);

  const entrance = frames.filter((frame) => frame.rootClass.includes("boot-app-in"));
  expect(entrance.some((frame) => frame.appTransform !== "none")).toBe(true);
  const overflowing = frames.filter((frame) => frame.scrollHeight > frame.clientHeight);
  expect(overflowing).toEqual([]);
  expect(new Set(frames.map((frame) => frame.clientWidth)).size).toBe(1);
  await expect(page.locator("main")).toBeVisible();
}
