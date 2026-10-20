import { expect, type Page, test } from "@playwright/test";

/**
 * The calendar header must keep one height as the day changes. Its title is a
 * weekday + date, so its intrinsic width moves with the glyphs alone — "Wed" is
 * wider than "Tue", "Sep 10" wider than "Oct 1" — and a header that can wrap
 * therefore flips row count on data, not on width, shoving the grid down ~36px
 * between two adjacent days.
 */

// Stepped finer than a single week's title-width spread (~17px at these sizes), so a
// bistable band cannot hide between two samples; the named phone widths are pinned too.
const SWEEP_WIDTHS = [...Array.from({ length: 15 }, (_, i) => 320 + i * 8), 390, 414, 430].sort(
  (a, b) => a - b,
);

async function openCalendar(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const explore = page.getByRole("button", { name: /explore with sample data/i });
  const main = page.locator("main");
  await expect(explore.or(main)).toBeVisible({ timeout: 20_000 });
  if (await explore.isVisible().catch(() => false)) {
    await explore.click();
    await expect(main).toBeVisible({ timeout: 15_000 });
  }
  await page.goto("/calendar", { waitUntil: "domcontentloaded" });
  await expect(main).toBeVisible({ timeout: 15_000 });
}

/** Header height plus the top of whatever sits under it — the first thing that shifts. */
function readHeaderMetrics(page: Page) {
  return page.locator("main header").evaluate((header) => {
    const below = header.nextElementSibling;
    return {
      title: header.querySelector("h1")?.textContent?.trim() ?? "",
      headerHeight: Math.round(header.getBoundingClientRect().height),
      contentTop: Math.round((below?.getBoundingClientRect().top ?? 0) - window.scrollY),
    };
  });
}

test("the calendar header keeps one height across all seven weekdays", async ({ page }) => {
  test.setTimeout(240_000);
  await openCalendar(page);
  const title = page.locator("main header h1");
  const nextDay = page.getByRole("button", { name: "Next day" });

  for (const width of SWEEP_WIDTHS) {
    await page.setViewportSize({ width, height: 844 });
    const week = [await readHeaderMetrics(page)];

    for (let step = 1; step < 7; step++) {
      const previous = week[step - 1].title;
      await nextDay.click();
      await expect(title).not.toHaveText(previous);
      week.push(await readHeaderMetrics(page));
    }

    const detail = week.map((d) => `${d.title} → ${d.headerHeight}px @${d.contentTop}`).join(" | ");
    expect(new Set(week.map((d) => d.headerHeight)).size, `${width}px — ${detail}`).toBe(1);
    expect(new Set(week.map((d) => d.contentTop)).size, `${width}px — ${detail}`).toBe(1);
  }
});
