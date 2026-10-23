import { expect, type Page } from "@playwright/test";
import { test } from "./fixtures";
import { enterApp } from "./helpers/app";

/**
 * Refactor guard for the display-zone rewrite. Signed out, `gcalStatus` is null, so the
 * display zone IS the browser zone and every answer here must stay byte-identical — this
 * proves the refactor changed nothing in the common case. The traveller case (display zone
 * ≠ browser zone) has no e2e route and is reported needs-human-smoke.
 */

test.use({ timezoneId: "Asia/Tokyo" });

const zonedDate = (instantMs: number) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(instantMs);

/** 03:00 UTC today is 12:00 in Asia/Tokyo — midday, safely inside the grid's 05:00–23:00 window. */
function pinnedNoonTokyo(): number {
  const t = new Date();
  t.setUTCHours(3, 0, 0, 0);
  return t.getTime();
}

function livedEvent(over: Record<string, unknown>) {
  return {
    id: "ce_zone",
    googleId: "g_zone",
    iCalUID: "u_zone",
    calendarId: "primary",
    title: "Zoned event",
    date: null,
    endDate: null,
    time: null,
    durationMin: 60,
    allDay: false,
    recurringEventId: null,
    googleUpdated: null,
    status: "confirmed",
    responseStatus: "accepted",
    valueId: null,
    goalId: null,
    note: "",
    vegaEditedAt: null,
    pendingDelete: false,
    removedAt: null,
    ...over,
  };
}

async function seedEvent(page: Page, ev: Record<string, unknown>) {
  await page.evaluate(
    (e) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open("vega-life-os");
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains("calendarEvents")) return resolve();
          const tx = db.transaction("calendarEvents", "readwrite");
          tx.objectStore("calendarEvents").put(e);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      }),
    ev,
  );
}

test("the now-line sits on the column the grid calls today", async ({ page }) => {
  // Installed before the first goto: the clock only reaches scripts that run after it.
  await page.clock.install({ time: pinnedNoonTokyo() });
  await enterApp(page);

  await page.goto("/calendar");
  const todayColumn = page.getByRole("button", { name: /^Add task on .*, today$/ });
  await expect(todayColumn).toHaveCount(1);

  const nowLine = page.locator("[data-now-line]");
  await expect(nowLine).toHaveCount(1);

  const lineBox = await nowLine.boundingBox();
  const columnBox = await todayColumn.boundingBox();
  expect(lineBox).not.toBeNull();
  expect(columnBox).not.toBeNull();
  if (!lineBox || !columnBox) return;
  expect(lineBox.x).toBeGreaterThanOrEqual(columnBox.x - 2);
  expect(lineBox.x + lineBox.width).toBeLessThanOrEqual(columnBox.x + columnBox.width + 2);
});

test("a finished event dims on Today and an upcoming one does not", async ({ page }) => {
  const pinned = pinnedNoonTokyo();
  const today = zonedDate(pinned);
  await page.clock.install({ time: pinned });
  await enterApp(page);

  await seedEvent(
    page,
    livedEvent({
      id: "ce_past",
      googleId: "g_past",
      iCalUID: "u_past",
      title: "Finished",
      date: today,
      time: "10:00",
    }),
  );
  await seedEvent(
    page,
    livedEvent({
      id: "ce_future",
      googleId: "g_future",
      iCalUID: "u_future",
      title: "Upcoming",
      date: today,
      time: "13:00",
    }),
  );
  await enterApp(page);

  await expect(page.locator('[data-event-id="ce_past"]')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[data-event-id="ce_future"]')).toBeVisible();

  await expect(page.locator('.opacity-60 [data-event-id="ce_past"]')).toHaveCount(1);
  await expect(page.locator('.opacity-60 [data-event-id="ce_future"]')).toHaveCount(0);
});
