import { expect, type Page, test } from "@playwright/test";
import { enterApp, passGratitudeGate } from "./helpers/app";

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
  const gate = page.getByRole("button", { name: "Continue to today" });
  await expect(gate.or(todayHeading(page))).toBeVisible({ timeout: 20_000 });
  await passGratitudeGate(page);
  await expect(todayHeading(page)).toBeVisible();
}

const nudge = (page: Page) => page.getByText(/You missed gratitude/);

test("today: a dismissed gratitude nudge stays dismissed; only a newer miss returns", async ({
  page,
}) => {
  const today = noonToday();
  await page.clock.setFixedTime(today - 2 * DAY_MS);
  await enterApp(page);

  await page.clock.setFixedTime(today);
  await reloadToToday(page);
  await expect(nudge(page)).toHaveText(
    `You missed gratitude on ${toLongDate(today - DAY_MS)} — add it?`,
  );

  await page.getByRole("button", { name: "Dismiss reminder" }).click();
  await expect(nudge(page)).toBeHidden();

  await reloadToToday(page);
  await expect(nudge(page)).toBeHidden();

  await page.clock.setFixedTime(today + 2 * DAY_MS);
  await reloadToToday(page);
  await expect(nudge(page)).toHaveText(
    `You missed gratitude on ${toLongDate(today + DAY_MS)} — add it?`,
  );
});

test("today: Back from the journal returns to the day it was opened from", async ({ page }) => {
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
