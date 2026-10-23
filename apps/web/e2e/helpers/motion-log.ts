import type { Page } from "@playwright/test";

interface MotionLog {
  animations: string[];
  transitions: string[];
}

/** Records every CSS animation and transition that starts, so a spec can prove which beats
 *  ran (and how often) without racing their timing. Applies from the next navigation on. */
export async function recordMotion(page: Page) {
  await page.addInitScript(() => {
    const log: MotionLog = { animations: [], transitions: [] };
    Object.assign(window, { __motionLog: log });
    document.addEventListener("animationstart", (e) => log.animations.push(e.animationName), true);
    document.addEventListener(
      "transitionrun",
      (e) => {
        const target = e.target as Element;
        log.transitions.push(`${target.className}|${e.propertyName}`);
      },
      true,
    );
  });
}

export function readMotion(page: Page): Promise<MotionLog> {
  return page.evaluate(() => (window as unknown as { __motionLog: MotionLog }).__motionLog);
}

export const countOf = (names: string[], name: string) => names.filter((n) => n === name).length;
