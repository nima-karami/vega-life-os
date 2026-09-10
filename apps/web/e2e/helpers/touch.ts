import type { CDPSession, Locator, Page } from "@playwright/test";

/**
 * Real touch and stylus input, injected at the browser's input layer through CDP.
 *
 * `page.mouse` emits pointer-from-mouse even on a touch device profile, and
 * `dispatchEvent("touchstart")` is a synthetic DOM event that never reaches the
 * compositor — neither one can produce a `touch-action` / native-scroll conflict,
 * which is the whole bug class these specs exist to reproduce. A stylus is the
 * exception: CDP has no touch channel for it, so `penDrag` dispatches on the mouse
 * channel with `pointerType: "pen"`.
 *
 * A pointer-media gate cannot be driven from here, and every way it fails is silent — the
 * wrong branch simply renders and the assertion reads the other string (measured 2026-09-09):
 * `Emulation.setEmulatedMedia` ignores `pointer`/`any-pointer` features; touch is a *context*
 * property, so a fresh page comes back coarse and only its own session is fine-pointered; and
 * `hasTouch` moves `pointer` and `any-pointer` together, so no configuration reproduces the
 * hybrid device (fine primary, finger available) that `useAnyCoarsePointer` exists for.
 *
 * Velocity is a test input: a swipe of `distance` px over `durationMs` releases at
 * roughly `distance / durationMs * 1000` px/s, because the moves are evenly spaced
 * and really awaited. framer-motion reads the last ~100ms of that move history, so a
 * 320px path over 400ms lands at ~800px/s and a 320px path over 133ms at ~2400px/s.
 */

export interface TouchFinger {
  x: number;
  y: number;
  /** Stable across a sequence; only needed when two fingers are down at once. */
  id?: number;
}

export interface SwipePath {
  from: TouchFinger;
  to: TouchFinger;
  durationMs: number;
  steps: number;
}

type TouchEventType = "touchStart" | "touchEnd" | "touchMove" | "touchCancel";

const TOUCH_RADIUS_PX = 12;
const DEFAULT_LONG_PRESS_MS = 650;

const cdpSessions = new WeakMap<Page, Promise<CDPSession>>();

function openInputSession(page: Page): Promise<CDPSession> {
  const existing = cdpSessions.get(page);
  if (existing) return existing;
  const session = page.context().newCDPSession(page);
  cdpSessions.set(page, session);
  return session;
}

async function dispatchTouch(page: Page, type: TouchEventType, fingers: TouchFinger[]) {
  const session = await openInputSession(page);
  await session.send("Input.dispatchTouchEvent", {
    type,
    touchPoints: fingers.map((finger, index) => ({
      x: Math.round(finger.x),
      y: Math.round(finger.y),
      id: finger.id ?? index,
      radiusX: TOUCH_RADIUS_PX,
      radiusY: TOUCH_RADIUS_PX,
      force: 1,
    })),
  });
}

const asFingers = (fingers: TouchFinger | TouchFinger[]): TouchFinger[] =>
  Array.isArray(fingers) ? fingers : [fingers];

const interpolate = (path: SwipePath, progress: number): TouchFinger => ({
  x: path.from.x + (path.to.x - path.from.x) * progress,
  y: path.from.y + (path.to.y - path.from.y) * progress,
  id: path.from.id,
});

type PenEventType = "mousePressed" | "mouseMoved" | "mouseReleased";

// CDP carries a stylus on the mouse channel, so pen never comes through dispatchTouchEvent.
async function dispatchPen(page: Page, type: PenEventType, point: TouchFinger) {
  const session = await openInputSession(page);
  await session.send("Input.dispatchMouseEvent", {
    type,
    x: Math.round(point.x),
    y: Math.round(point.y),
    button: "left",
    buttons: type === "mouseReleased" ? 0 : 1,
    clickCount: 1,
    force: 1,
    pointerType: "pen",
  });
}

/** A stylus press-drag-lift: the pointer that is neither a mouse nor a finger. */
export async function penDrag(page: Page, path: SwipePath) {
  await dispatchPen(page, "mousePressed", path.from);
  const gapMs = path.durationMs / path.steps;
  for (let step = 1; step <= path.steps; step += 1) {
    await dispatchPen(page, "mouseMoved", interpolate(path, step / path.steps));
    await page.waitForTimeout(gapMs);
  }
  await dispatchPen(page, "mouseReleased", path.to);
}

export async function startTouch(page: Page, fingers: TouchFinger | TouchFinger[]) {
  await dispatchTouch(page, "touchStart", asFingers(fingers));
}

export async function moveTouch(page: Page, fingers: TouchFinger | TouchFinger[]) {
  await dispatchTouch(page, "touchMove", asFingers(fingers));
}

/** Releases the listed fingers — measured, not the state list the name once implied. `[]`
 *  releases every finger still down, which is why every single-finger call passes nothing. */
export async function endTouch(page: Page, release: TouchFinger[] = []) {
  await dispatchTouch(page, "touchEnd", release);
}

/** A genuine browser-level `pointercancel` — what an OS gesture takeover produces. */
export async function cancelTouch(page: Page) {
  await dispatchTouch(page, "touchCancel", []);
}

/**
 * Walks the path in real wall-clock time and leaves the finger down at `path.to`.
 *
 * Position comes from elapsed time, not from the step counter: a CDP round-trip costs
 * ~20ms, so pacing by `waitForTimeout(durationMs / steps)` alone stretches a nominal
 * 180ms flick to ~370ms and halves the velocity the page actually sees. `steps` is the
 * requested sample rate; the achieved sample count drops when the gap is under the
 * round-trip cost, but the gesture still spans `durationMs`.
 */
export async function dragAlong(page: Page, path: SwipePath) {
  const startedAt = Date.now();
  const gapMs = path.durationMs / path.steps;
  let sample = 1;
  let elapsedMs = Date.now() - startedAt;
  while (elapsedMs < path.durationMs) {
    await moveTouch(page, interpolate(path, elapsedMs / path.durationMs));
    sample += 1;
    const waitMs = gapMs * sample - (Date.now() - startedAt);
    if (waitMs > 1) await page.waitForTimeout(waitMs);
    elapsedMs = Date.now() - startedAt;
  }
  await moveTouch(page, path.to);
}

export async function startSwipe(page: Page, path: SwipePath) {
  await startTouch(page, path.from);
  await dragAlong(page, path);
}

export async function swipe(page: Page, path: SwipePath) {
  await startSwipe(page, path);
  await endTouch(page);
}

/** A swipe that stops moving before it lifts — the finger rests, so release velocity is ~0. */
export async function swipeThenHold(page: Page, path: SwipePath, holdMs: number) {
  await startSwipe(page, path);
  await page.waitForTimeout(holdMs);
  await moveTouch(page, path.to);
  await page.waitForTimeout(holdMs);
  await endTouch(page);
}

export async function tap(page: Page, point: TouchFinger) {
  await startTouch(page, point);
  await page.waitForTimeout(40);
  await endTouch(page);
}

export interface LongPressOptions {
  holdMs?: number;
  jitterPx?: number;
}

/** Held in place, with an optional sub-tolerance wobble so the press is not unnaturally still. */
export async function longPress(page: Page, point: TouchFinger, options?: LongPressOptions) {
  const holdMs = options?.holdMs ?? DEFAULT_LONG_PRESS_MS;
  const jitterPx = options?.jitterPx ?? 0;
  await startTouch(page, point);
  await page.waitForTimeout(holdMs / 2);
  if (jitterPx !== 0) await moveTouch(page, { ...point, x: point.x + jitterPx });
  await page.waitForTimeout(holdMs / 2);
  await endTouch(page);
}

export interface CardAnchors {
  centre: TouchFinger;
  leftEdgeInset: TouchFinger;
  rightEdgeInset: TouchFinger;
  upperMiddle: TouchFinger;
  lowerBand: TouchFinger;
  width: number;
  height: number;
}

/** Viewport-relative anchors so a spec never hard-codes a coordinate. */
export async function measureCardAnchors(card: Locator, insetPx = 8): Promise<CardAnchors> {
  const box = await card.boundingBox();
  if (box === null) throw new Error("the card has no bounding box");
  const centreX = box.x + box.width / 2;
  const centreY = box.y + box.height / 2;
  return {
    centre: { x: centreX, y: centreY },
    leftEdgeInset: { x: box.x + insetPx, y: centreY },
    rightEdgeInset: { x: box.x + box.width - insetPx, y: centreY },
    upperMiddle: { x: centreX, y: box.y + box.height * 0.3 },
    lowerBand: { x: centreX, y: box.y + box.height - insetPx },
    width: box.width,
    height: box.height,
  };
}

/** Where a swipe of `speedPxPerSec` at `degreesOffVertical` ends, starting from `origin`. */
export function projectFlick(
  origin: TouchFinger,
  options: { degreesOffVertical: number; speedPxPerSec: number; durationMs: number },
): TouchFinger {
  const distance = (options.speedPxPerSec * options.durationMs) / 1000;
  const radians = (options.degreesOffVertical * Math.PI) / 180;
  return {
    x: origin.x + distance * Math.sin(radians),
    y: origin.y - distance * Math.cos(radians),
  };
}
