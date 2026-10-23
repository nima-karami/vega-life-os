import { expect, type Page } from "@playwright/test";
import { test } from "./fixtures";
import { DAY_MS, enterApp, upcomingMondayNoon } from "./helpers/app";

// The clock stalls route animations, so these assert on the DOM rather than on paint.
async function bootTodayAt(page: Page, time: Date) {
  await page.clock.install({ time });
  await enterApp(page);
  await page.goto("/today", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1, name: "Today", exact: true })).toBeAttached({
    timeout: 15_000,
  });
}

const freshStart = (page: Page) => page.getByRole("region", { name: "A new week" });

test("Today greets a Monday with the new week and the in-season values", async ({ page }) => {
  await bootTodayAt(page, upcomingMondayNoon());
  const card = freshStart(page);
  await expect(card).toContainText("A new week starts today.");
  await expect(card.getByRole("list", { name: "In season" }).getByRole("listitem")).not.toHaveCount(
    0,
  );

  await page.getByRole("button", { name: "Next day" }).click();
  await expect(freshStart(page)).toHaveCount(0);
});

test("Today shows no new-week card on a Tuesday", async ({ page }) => {
  await bootTodayAt(page, new Date(upcomingMondayNoon().getTime() + DAY_MS));
  await expect(page.getByRole("button", { name: "Previous day" })).toBeAttached();
  await expect(freshStart(page)).toHaveCount(0);
});

test("Got it dismisses the card for the week, and the next Monday brings it back", async ({
  page,
}) => {
  const monday = upcomingMondayNoon();
  await bootTodayAt(page, monday);
  await freshStart(page).getByRole("button", { name: "Got it" }).click();
  await expect(freshStart(page)).toHaveCount(0);

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "Previous day" })).toBeAttached({
    timeout: 15_000,
  });
  await expect(freshStart(page)).toHaveCount(0);

  await page.clock.setFixedTime(new Date(monday.getTime() + 7 * DAY_MS));
  await page.goto("/today", { waitUntil: "domcontentloaded" });
  await expect(freshStart(page)).toContainText("A new week starts today.", { timeout: 15_000 });
});
