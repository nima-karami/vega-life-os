const SPLASH_ID = "boot";
const GRACE_MS = 300;
const DRAW_END_MS = 720;
const TAGLINE_IN_MS = 640;
const TAGLINE_DWELL_MS = 600;
const STATUS_IN_MS = 3000;
const TAGLINE_RETURN_MS = 120;
const REMOVE_FALLBACK_MS = 400;

export type BootHandoff = { kind: "direct" } | { kind: "out"; outAt: number; isReturn: boolean };

/** Times are on the splash's own animation clock, so they match what is on screen. */
export function planBootHandoff(readyAt: number, isUrgent: boolean): BootHandoff {
  if (readyAt < GRACE_MS) return { kind: "direct" };
  if (isUrgent) return { kind: "out", outAt: Math.max(readyAt, DRAW_END_MS), isReturn: false };
  if (readyAt >= STATUS_IN_MS) {
    return { kind: "out", outAt: readyAt + TAGLINE_RETURN_MS + TAGLINE_DWELL_MS, isReturn: true };
  }
  return {
    kind: "out",
    outAt: Math.max(readyAt, TAGLINE_IN_MS + TAGLINE_DWELL_MS),
    isReturn: false,
  };
}

let isDismissing = false;

export function hasBootSplash(): boolean {
  return document.getElementById(SPLASH_ID) !== null;
}

// Finished animations hold their currentTime, so measure from the earliest start instead.
function readSplashElapsed(splash: HTMLElement): number {
  const now = document.timeline.currentTime;
  const startTimes = splash
    .getAnimations({ subtree: true })
    .map((animation) => animation.startTime)
    .filter((time): time is number => typeof time === "number");
  if (typeof now !== "number" || startTimes.length === 0) return performance.now();
  return now - Math.min(...startTimes);
}

function playAppEntrance(appRoot: HTMLElement, className: string) {
  const handleEnd = (event: AnimationEvent) => {
    if (event.target !== appRoot) return;
    appRoot.classList.remove(className);
    appRoot.removeEventListener("animationend", handleEnd);
  };
  appRoot.addEventListener("animationend", handleEnd);
  appRoot.classList.add(className);
}

function bringTaglineBack(splash: HTMLElement) {
  const opacityOf = (selector: string) => {
    const line = splash.querySelector(selector);
    return line ? getComputedStyle(line).opacity : "0";
  };
  splash.style.setProperty("--boot-tag-from", opacityOf(".boot-tag"));
  splash.style.setProperty("--boot-status-from", opacityOf(".boot-status"));
  splash.dataset.state = "return";
}

function removeAfterExit(splash: HTMLElement) {
  const stage = splash.querySelector(".boot-stage");
  const remove = () => splash.remove();
  stage?.addEventListener("animationend", (event) => {
    if (event.target === stage) remove();
  });
  setTimeout(remove, REMOVE_FALLBACK_MS);
}

/** Hands the static index.html splash over to the mounted app; safe to call repeatedly. */
export function dismissBootSplash({ isUrgent = false } = {}): void {
  const splash = document.getElementById(SPLASH_ID);
  const appRoot = document.getElementById("root");
  if (isDismissing || !splash || !appRoot) return;
  isDismissing = true;

  const elapsed = readSplashElapsed(splash);
  const handoff = planBootHandoff(elapsed, isUrgent);
  if (handoff.kind === "direct") {
    splash.remove();
    playAppEntrance(appRoot, "boot-app-fast");
    return;
  }
  if (handoff.isReturn) bringTaglineBack(splash);

  const beginOut = () => {
    dwell.cancel();
    splash.removeEventListener("pointerdown", beginOut);
    window.removeEventListener("keydown", handleSkipKey, true);
    splash.dataset.state = `${splash.dataset.state ?? ""} out`.trim();
    playAppEntrance(appRoot, "boot-app-in");
    removeAfterExit(splash);
  };
  const handleSkipKey = (event: KeyboardEvent) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    beginOut();
  };
  // A keyframe-less animation, not a timer: the dwell runs on the same clock as the splash it waits on.
  const dwell = splash.animate(null, { duration: Math.max(0, handoff.outAt - elapsed) });
  dwell.onfinish = beginOut;
  splash.addEventListener("pointerdown", beginOut);
  window.addEventListener("keydown", handleSkipKey, true);
}
