import { expect, type Page } from "@playwright/test";
import { test } from "./fixtures";
import { enterApp, gratitudePage, saveGratitude } from "./helpers/app";
import { expectJournalButtonInHeader } from "./helpers/today-header";

/**
 * Today keeps its place: a dismissed missed-gratitude nudge stays dismissed across
 * reloads (only a newer miss re-surfaces it), and Back from the journal lands on the
 * day the journal was opened from — the viewed day lives in `?date=`.
 */

const DAY_MS = 86_400_000;

function noonToday(): number {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d.getTime();
}

function toISO(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toLongDate(ms: number): string {
  const d = new Date(ms);
  const weekday = d.toLocaleDateString("en-US", { weekday: "short" });
  const month = d.toLocaleDateString("en-US", { month: "short" });
  return `${weekday} · ${month} ${d.getDate()} · ${d.getFullYear()}`;
}

const todayHeading = (page: Page) =>
  page.getByRole("heading", { level: 1, name: "Today", exact: true });

async function reloadToToday(page: Page) {
  await page.goto("/today");
  await expect(todayHeading(page)).toBeVisible({ timeout: 20_000 });
}

const nudge = (page: Page) => page.getByText(/haven't written gratitude for/);

test("today: a dismissed gratitude nudge stays dismissed; only a newer miss returns", async ({
  page,
}) => {
  const today = noonToday();
  await page.clock.setFixedTime(today - 2 * DAY_MS);
  await enterApp(page, { keepGratitudePage: true });
  await saveGratitude(page);

  await page.clock.setFixedTime(today);
  await page.goto("/today");
  await saveGratitude(page);
  await expect(nudge(page)).toHaveText(
    `You haven't written gratitude for ${toLongDate(today - DAY_MS)}. Add it?`,
  );

  await page.getByRole("button", { name: "Dismiss reminder" }).click();
  await expect(nudge(page)).toBeHidden();

  await reloadToToday(page);
  await expect(nudge(page)).toBeHidden();

  await page.clock.setFixedTime(today + 2 * DAY_MS);
  await page.goto("/today");
  await saveGratitude(page);
  await expect(nudge(page)).toHaveText(
    `You haven't written gratitude for ${toLongDate(today + DAY_MS)}. Add it?`,
  );
});

test("today: a skipped day is never reported missed later", async ({ page }) => {
  const today = noonToday();
  await page.clock.setFixedTime(today - DAY_MS);
  await enterApp(page, { keepGratitudePage: true });
  await saveGratitude(page);

  await page.clock.setFixedTime(today);
  await page.goto("/today");
  await gratitudePage(page).getByRole("button", { name: "Continue" }).click();
  await expect(todayHeading(page)).toBeVisible();

  await page.clock.setFixedTime(today + DAY_MS);
  await page.goto("/today");
  await saveGratitude(page);
  await expect(todayHeading(page)).toBeVisible();
  await expect(nudge(page)).toBeHidden();
});

test("today: Back from the journal returns to the day it was opened from", async ({ page }) => {
  // A running clock pinned to noon: no midnight rollover, and route animations still advance.
  await page.clock.install({ time: noonToday() });
  await enterApp(page);
  const twoDaysAgo = noonToday() - 2 * DAY_MS;
  const weekday = new Date(twoDaysAgo).toLocaleDateString("en-US", { weekday: "long" });

  const twoDaysAgoUrl = new RegExp(`:\\d+/(today)?\\?date=${toISO(twoDaysAgo)}$`);
  const plainTodayUrl = /:\d+\/(today)?$/;

  await page.getByRole("button", { name: "Previous day" }).click();
  await page.getByRole("button", { name: "Previous day" }).click();
  await expect(page).toHaveURL(twoDaysAgoUrl);
  await expect(page.getByRole("heading", { level: 1, name: weekday })).toBeVisible();

  await page.getByRole("button", { name: /^(Journal|Edit entry)$/ }).click();
  await expect(page).toHaveURL(new RegExp(`/journal/${toISO(twoDaysAgo)}$`));
  await page.getByRole("button", { name: "Back", exact: true }).click();

  await expect(page).toHaveURL(twoDaysAgoUrl);
  await expect(page.getByRole("heading", { level: 1, name: weekday })).toBeVisible();

  await page.getByRole("button", { name: "Jump to today" }).click();
  await expect(page).toHaveURL(plainTodayUrl);
  await page.getByRole("button", { name: /^(Journal|Edit entry)$/ }).click();
  await page.getByRole("button", { name: "Back", exact: true }).click();

  await expect(page).toHaveURL(plainTodayUrl);
  await expect(todayHeading(page)).toBeVisible();
});

test("today: the journal pill sits in the header and follows the date nav in focus order", async ({
  page,
}) => {
  await enterApp(page);
  await expectJournalButtonInHeader(page, "Journal");

  await page.getByRole("button", { name: "Next day" }).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Journal", exact: true })).toBeFocused();
});
