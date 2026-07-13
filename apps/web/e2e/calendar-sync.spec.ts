import { expect, test } from "@playwright/test";

/**
 * Lived-event (Google Calendar) tagging proof. The OAuth/connect flow needs a real
 * Google client id, so this seeds a CalendarEvent straight into the store's IndexedDB
 * and verifies the rendering + value-credit paths the engine feeds.
 */

async function bootSandbox(page: import("@playwright/test").Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const explore = page.getByRole("button", { name: /explore with sample data/i });
  const main = page.locator("main");
  await expect(explore.or(main)).toBeVisible({ timeout: 20_000 });
  if (await explore.isVisible().catch(() => false)) {
    await explore.click();
    await expect(main).toBeVisible({ timeout: 15_000 });
  }
}

async function passGratitudeGate(page: import("@playwright/test").Page) {
  const gate = page.getByRole("button", { name: "Continue to today" });
  if (await gate.isVisible().catch(() => false)) {
    await page.getByRole("textbox", { name: "Grateful for, item 1" }).fill("e2e gratitude");
    await gate.click();
  }
}

function livedEvent(over: Record<string, unknown>) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: "ce_e2e",
    googleId: "g_e2e",
    iCalUID: "u_e2e",
    calendarId: "primary",
    title: "Concert with friends",
    date: today,
    time: "09:00",
    durationMin: 120,
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

async function seedEvent(page: import("@playwright/test").Page, ev: Record<string, unknown>) {
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

test("a tagged lived event shows on the calendar and credits its value", async ({ page }) => {
  await bootSandbox(page);
  await passGratitudeGate(page);
  // v2 (Presence) exists in the seed dataset.
  await seedEvent(page, livedEvent({ valueId: "v2" }));
  await bootSandbox(page); // reload + re-enter so the store hydrates the seeded row
  await passGratitudeGate(page);

  await page.goto("/calendar", { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-event-id="ce_e2e"]')).toBeVisible({ timeout: 15_000 });

  await page.goto("/analytics", { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-value-total="v2"]')).toBeVisible({ timeout: 15_000 });
});

test("a multi-day Google event spans every day it covers in the all-day row", async ({ page }) => {
  await bootSandbox(page);
  await passGratitudeGate(page);
  // A 7-day all-day span centred on today, so several covered days are always in the
  // visible week regardless of where today sits in it.
  const day = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
  };
  await seedEvent(
    page,
    livedEvent({
      id: "ce_span",
      googleId: "g_span",
      iCalUID: "u_span",
      title: "Roadtrip",
      date: day(-3),
      endDate: day(3),
      time: null,
      allDay: true,
      durationMin: 0,
    }),
  );
  await bootSandbox(page);
  await passGratitudeGate(page);

  await page.goto("/calendar", { waitUntil: "domcontentloaded" });
  const bar = page.getByRole("button", { name: /Roadtrip, multi-day/ });
  await expect(bar).toHaveCount(1); // one continuous bar, not a chip per day
  // The bar spans several day columns, so it's far wider than a single column (~160px).
  const box = await bar.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(300);
});

test("clicking an untagged lived event opens the editor", async ({ page }) => {
  await bootSandbox(page);
  await passGratitudeGate(page);
  await seedEvent(page, livedEvent({ valueId: null }));
  await bootSandbox(page);
  await passGratitudeGate(page);

  await page.goto("/calendar", { waitUntil: "domcontentloaded" });
  await page.locator('[data-event-id="ce_e2e"]').click({ timeout: 15_000 });
  await expect(page.getByText("From Google Calendar")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Event title" })).toHaveValue(
    "Concert with friends",
  );
});
