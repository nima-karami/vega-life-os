import type { Page } from "@playwright/test";

/** One animation frame of the index.html boot splash, on the splash's own clock. */
export type BootFrame = {
  isGone: boolean;
  splashTime: number | null;
  state: string;
  tileOpacity: number;
  tileTransform: string;
  strokeOffset: string;
  tagOpacity: number;
  tagTransform: string;
  statusOpacity: number;
  rootClass: string;
};

export type BootTrace = { frames: BootFrame[]; tapTime: number | null };

type TracedWindow = Window & { __bootTrace?: BootTrace };

/** Samples the splash every frame from first paint until it has been gone a while. */
export async function traceBootSplash(page: Page) {
  await page.addInitScript(() => {
    const trace: BootTrace = { frames: [], tapTime: null };
    (window as TracedWindow).__bootTrace = trace;
    let epoch: number | null = null;
    const readTime = (splash: HTMLElement | null): number | null => {
      const now = document.timeline.currentTime;
      if (typeof now !== "number") return null;
      if (epoch === null && splash) {
        const starts = splash
          .getAnimations({ subtree: true })
          .map((animation) => animation.startTime)
          .filter((time): time is number => typeof time === "number");
        if (starts.length > 0) epoch = Math.min(...starts);
      }
      return epoch === null ? null : now - epoch;
    };
    window.addEventListener(
      "pointerdown",
      () => {
        trace.tapTime = readTime(document.getElementById("boot"));
      },
      true,
    );
    let goneFrames = 0;
    const absent = { opacity: "0", transform: "none", strokeDashoffset: "" };
    const sample = () => {
      const splash = document.getElementById("boot");
      const isGone = !splash && document.readyState !== "loading";
      const styleOf = (selector: string) => {
        const node = splash?.querySelector(selector);
        return node ? getComputedStyle(node) : absent;
      };
      trace.frames.push({
        isGone,
        splashTime: readTime(splash),
        state: splash?.dataset.state ?? "",
        tileOpacity: Number(styleOf(".boot-tile").opacity),
        tileTransform: styleOf(".boot-tile").transform,
        strokeOffset: styleOf(".boot-v").strokeDashoffset,
        tagOpacity: Number(styleOf(".boot-tag").opacity),
        tagTransform: styleOf(".boot-tag").transform,
        statusOpacity: Number(styleOf(".boot-status").opacity),
        rootClass: document.getElementById("root")?.className ?? "",
      });
      if (isGone) goneFrames += 1;
      if (goneFrames < 30 && trace.frames.length < 4000) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
}

export async function readBootTrace(page: Page): Promise<BootTrace> {
  await page.waitForFunction(() => {
    const frames = (window as TracedWindow).__bootTrace?.frames ?? [];
    return frames.filter((frame) => frame.isGone).length >= 30;
  });
  return page.evaluate(() => (window as TracedWindow).__bootTrace as BootTrace);
}

/** Holds the app bundle back, so the store is ready no earlier than `delayMs` after the splash paints. */
export async function delayAppBundle(page: Page, delayMs: number) {
  await page.route("**/src/main.tsx", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    await route.continue();
  });
}

/** Scales the page's animation clock, which the splash, its dwell and its trace all run on.
 *  A dev-server boot takes seconds, so this is how a spec puts "ready" at a chosen splash time. */
export async function scaleSplashClock(page: Page, playbackRate: number) {
  const devtools = await page.context().newCDPSession(page);
  await devtools.send("Animation.enable");
  await devtools.send("Animation.setPlaybackRate", { playbackRate });
}
