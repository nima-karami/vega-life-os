import { expect, type Page } from "@playwright/test";
import { test } from "../fixtures";

/** Collects console errors and uncaught errors from the next navigation on. */
export async function trackPageErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console.error: ${message.text()}`);
  });
  // A ResizeObserver loop reaches window.onerror with no Error object, so CDP never reports it.
  await page.addInitScript(() =>
    window.addEventListener("error", (event) => {
      if (event.error == null) console.error(`window error: ${event.message}`);
    }),
  );
  return errors;
}

/** Fails every test in the calling file that logs a console error or throws. */
export function failOnPageErrors() {
  let errors: string[] = [];
  test.beforeEach(async ({ page }) => {
    errors = await trackPageErrors(page);
  });
  test.afterEach(() => {
    expect(errors).toEqual([]);
  });
}
