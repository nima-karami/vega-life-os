import { expect, type Page, test } from "@playwright/test";
import { enterApp, saveGratitude } from "./helpers/app";

/**
 * `journal.spec.ts` runs only in the chromium project, so nothing there reaches the
 * `/entries` compact branch. The `.mobile.spec.ts` suffix routes this file into the
 * Pixel 7 project instead. The beforeEach writes today's gratitude, which is the row every assertion here reads.
 */

const WIDTHS = [320, 360, 390, 430];

function todayISO(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${String(now.getDate()).padStart(2, "0")}`;
}

const TODAY = todayISO();

const entryRow = (page: Page) => page.getByRole("button", { name: /^Open entry for / }).first();

/**
 * The widest sideways drag left inside `main`. Only scrollable boxes count — a `truncate`
 * span clips with `overflow: hidden` and still reports its full text as scrollWidth.
 */
function widestInnerOverflow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const main = document.querySelector("main");
    if (!main) return Number.POSITIVE_INFINITY;
    let worst = 0;
    for (const el of main.querySelectorAll("*")) {
      const overflowX = getComputedStyle(el).overflowX;
      if (overflowX !== "auto" && overflowX !== "scroll") continue;
      worst = Math.max(worst, el.scrollWidth - el.clientWidth);
    }
    return worst;
  });
}

test.beforeEach(async ({ page }) => {
  await enterApp(page);
  await saveGratitude(page);
});

for (const width of WIDTHS) {
  test(`entries stacks each row inside the viewport at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 780 });
    await page.goto("/entries", { waitUntil: "domcontentloaded" });

    const row = entryRow(page);
    await expect(row).toBeVisible({ timeout: 15_000 });

    // The desktop grid's 640px floor cannot fit any of these widths, so a row that fits
    // is proof the grid branch is not the one mounted.
    const box = await row.boundingBox();
    if (!box) throw new Error("the entry row has no bounding box");
    expect(box.width, `the entry row is ${box.width}px wide at ${width}px`).toBeLessThanOrEqual(
      width,
    );

    const pageOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(pageOverflow, `/entries overflows the page by ${pageOverflow}px`).toBeLessThanOrEqual(1);

    const innerOverflow = await widestInnerOverflow(page);
    expect(
      innerOverflow,
      `something inside main still scrolls sideways by ${innerOverflow}px`,
    ).toBeLessThanOrEqual(1);
  });
}

test("an entry row shows its date, status, gratitude and journal, and opens that day", async ({
  page,
}) => {
  await page.goto("/entries", { waitUntil: "domcontentloaded" });

  const row = entryRow(page);
  await expect(row).toBeVisible({ timeout: 15_000 });
  await expect(row).toContainText("Started");
  await expect(row).toContainText("e2e gratitude");
  await expect(row).toContainText("None");

  await row.click();
  await expect(page).toHaveURL(new RegExp(`/journal/${TODAY}$`));
  await expect(page.getByRole("textbox", { name: "Journal" })).toBeVisible({ timeout: 15_000 });
});
