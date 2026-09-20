import { expect, type Page, test } from "@playwright/test";
import {
  addDays,
  differenceInCalendarDays,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";

/**
 * Lived-event (Google Calendar) tagging proof. The OAuth/connect flow needs a real
 * Google client id, so this seeds a CalendarEvent straight into the store's IndexedDB
 * and verifies the rendering + value-credit paths the engine feeds.
 */

async function bootSandbox(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const explore = page.getByRole("button", { name: /explore with sample data/i });
  const main = page.locator("main");
  await expect(explore.or(main)).toBeVisible({ timeout: 20_000 });
  if (await explore.isVisible().catch(() => false)) {
    await explore.click();
    await expect(main).toBeVisible({ timeout: 15_000 });
  }
}

async function passGratitudeGate(page: Page) {
  const gate = page.getByRole("button", { name: "Continue to today" });
  if (await gate.isVisible().catch(() => false)) {
    await page.getByRole("textbox", { name: "Grateful for, item 1" }).fill("e2e gratitude");
    await gate.click();
  }
}

// Local date, matching the app's own `todayISO()` (core/lib/date.ts) — a UTC slice
// drifts a day off local "today" for half the clock, in either direction by tz.
function livedEvent(over: Record<string, unknown>) {
  const today = format(new Date(), "yyyy-MM-dd");
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

test("a tagged lived event shows on the calendar", async ({ page }) => {
  await bootSandbox(page);
  await passGratitudeGate(page);
  // v2 (Presence) exists in the seed dataset.
  await seedEvent(page, livedEvent({ valueId: "v2" }));
  await bootSandbox(page); // reload + re-enter so the store hydrates the seeded row
  await passGratitudeGate(page);

  await page.goto("/calendar", { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-event-id="ce_e2e"]')).toBeVisible({ timeout: 15_000 });
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

test("lived events land on Today in clock order and never touch the day's count", async ({
  page,
}) => {
  await bootSandbox(page);
  await passGratitudeGate(page);
  const summaryBefore = await page.locator("header p").nth(1).textContent();

  await seedEvent(page, livedEvent({ id: "ce_late", time: "20:00", title: "Late event" }));
  await seedEvent(
    page,
    livedEvent({
      id: "ce_early",
      googleId: "g_early",
      iCalUID: "u_early",
      time: "06:00",
      title: "Early event",
    }),
  );
  await bootSandbox(page);
  await passGratitudeGate(page);

  const rows = page.locator("[data-event-id]");
  await expect(rows).toHaveCount(2, { timeout: 15_000 });
  await expect(rows.first()).toHaveAttribute("data-event-id", "ce_early");
  await expect(rows.last()).toHaveAttribute("data-event-id", "ce_late");
  // Attendance is not completion: "X of Y done" is unmoved by two new events.
  await expect(page.locator("header p").nth(1)).toHaveText(summaryBefore ?? "");
});

test("clicking a lived event on Today opens the event editor", async ({ page }) => {
  await bootSandbox(page);
  await passGratitudeGate(page);
  await seedEvent(page, livedEvent({ valueId: null }));
  await bootSandbox(page);
  await passGratitudeGate(page);

  await page.locator('[data-event-id="ce_e2e"]').click({ timeout: 15_000 });
  await expect(page.getByText("From Google Calendar")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Event title" })).toHaveValue(
    "Concert with friends",
  );
});

// A mouse click carries a pixel of jitter between down and up, which used to set the drag's
// `moved` flag and swallow the tap — the chip looked dead.
test("a jittered click on a timed chip opens the editor and moves nothing", async ({ page }) => {
  await bootSandbox(page);
  await passGratitudeGate(page);
  await page.goto("/calendar", { waitUntil: "domcontentloaded" });

  const chip = page.getByRole("button", { name: /^Update ID card, 13:00–14:00/ });
  await expect(chip).toBeVisible({ timeout: 15_000 });
  // hover() scrolls the chip inside the grid's own scroller first; a raw box read there
  // points at a clipped position the mouse would miss.
  await chip.hover();
  const box = await chip.boundingBox();
  if (!box) throw new Error("the timed chip has no bounding box");

  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 1, box.y + box.height / 2 + 1);
  await page.mouse.up();

  await expect(page.getByRole("textbox", { name: "Task title" })).toHaveValue("Update ID card");
  await page.keyboard.press("Escape");
  await expect(chip).toBeVisible();
});

/**
 * A single-day all-day event on the Monday-anchored week start + 1, widened to week start + 3.
 * Both days are always inside the visible week; they are NOT always in the same month, which
 * is the case the month-grid index has to survive.
 */
function allDaySpanFixture(monday: Date) {
  return {
    starts: format(addDays(monday, 1), "yyyy-MM-dd"),
    laterEnd: format(addDays(monday, 3), "yyyy-MM-dd"),
  };
}

const offsiteChip = (page: Page) => page.getByRole("button", { name: /^Offsite, all day/ });

/** The CalendarPopover is portalled out of the modal as the only dialog holding a month nav. */
const monthPopover = (page: Page) =>
  page.getByRole("dialog").filter({ has: page.getByRole("button", { name: "Previous month" }) });

/**
 * Click a day in an open CalendarPopover. The popover opens on the month of its CURRENT
 * value, so the cell index is measured from THAT month's grid — measuring it from the
 * target's month addresses the wrong cell whenever the two differ.
 */
async function pickDateInPopover(page: Page, viewIso: string, targetIso: string) {
  const popover = monthPopover(page);
  await expect(popover).toBeVisible();
  const gridStart = startOfWeek(startOfMonth(parseISO(viewIso)), { weekStartsOn: 1 });
  const index = differenceInCalendarDays(parseISO(targetIso), gridStart);
  // Day cells are the only buttons named by a bare number; the month nav and Today/Clear are not.
  const cells = popover.getByRole("button", { name: /^\d{1,2}$/ });
  expect(index).toBeGreaterThanOrEqual(0);
  expect(index).toBeLessThan(await cells.count());
  await cells.nth(index).click();
}

async function openOffsite(page: Page, starts: string) {
  await bootSandbox(page);
  await passGratitudeGate(page);
  await seedEvent(
    page,
    livedEvent({
      id: "ce_allday",
      googleId: "g_allday",
      iCalUID: "u_allday",
      title: "Offsite",
      date: starts,
      endDate: starts,
      time: null,
      allDay: true,
      durationMin: 0,
    }),
  );
  await bootSandbox(page);
  await passGratitudeGate(page);
  await page.goto("/calendar", { waitUntil: "domcontentloaded" });
  await offsiteChip(page).click({ timeout: 15_000 });
  await expect(page.getByText("From Google Calendar")).toBeVisible();
}

const endsTrigger = (page: Page) => page.getByRole("button", { name: "Ends" });
const readsDay = (iso: string) => format(parseISO(iso), "EEE · MMM d, yyyy");

async function widenEndsAndVerify(page: Page, starts: string, laterEnd: string) {
  await openOffsite(page, starts);
  await endsTrigger(page).click();
  await pickDateInPopover(page, starts, laterEnd);
  // Fails loudly if the index addressed the wrong cell: a day before Starts clamps back to it.
  await expect(endsTrigger(page)).toContainText(readsDay(laterEnd));
  // Not a bare "Done": every resolved task chip on the grid ends its label with ", done".
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Offsite, multi-day/ })).toHaveCount(1);
}

test("an all-day Google event's dates can be changed from the editor", async ({ page }) => {
  const { starts } = allDaySpanFixture(startOfWeek(new Date(), { weekStartsOn: 1 }));
  await openOffsite(page, starts);

  await expect(page.getByRole("button", { name: "Starts" })).toBeVisible();
  await expect(endsTrigger(page)).toBeVisible();
  // An all-day event has no time block to edit; the row it would occupy is the dates row.
  await expect(page.getByText("Time block")).toHaveCount(0);
});

test("widening an all-day event's Ends turns its chip into a span bar and survives a reload", async ({
  page,
}) => {
  const { starts, laterEnd } = allDaySpanFixture(startOfWeek(new Date(), { weekStartsOn: 1 }));
  await widenEndsAndVerify(page, starts, laterEnd);

  await bootSandbox(page);
  await passGratitudeGate(page);
  await page.goto("/calendar", { waitUntil: "domcontentloaded" });
  const bar = page.getByRole("button", { name: /^Offsite, multi-day/ });
  await expect(bar).toHaveCount(1, { timeout: 15_000 });

  // Ends reads the INCLUSIVE last day, not the exclusive end Google is sent.
  await bar.click();
  await expect(endsTrigger(page)).toContainText(readsDay(laterEnd));
});

/**
 * Weeks whose Monday+1 and Monday+3 sit in different months — the popover then renders a
 * month that is not the target's, which used to address the wrong cell. These recur roughly
 * quarterly, so they are pinned with page.clock rather than left to the day the suite runs.
 */
const MONTH_STRADDLING_MONDAYS = [
  "2026-09-28", // Sep -> Oct
  "2026-03-30", // Mar -> Apr, the Monday after the EU clocks change
  "2026-06-29", // Jun -> Jul
  "2027-03-29", // Mar -> Apr, next year
  "2025-12-29", // Dec -> Jan, across the year boundary
];

for (const monday of MONTH_STRADDLING_MONDAYS) {
  test(`Ends spans a month boundary in the week of ${monday}`, async ({ page }) => {
    // Load-bearing, not setup noise: these dates are fixed, so without the clock pin they
    // stop describing the week the app is on and become real date bombs — three are already
    // in the past. Midday UTC keeps the pinned day one calendar day in any runner zone.
    await page.clock.install({ time: new Date(`${monday}T12:00:00Z`) });
    const { starts, laterEnd } = allDaySpanFixture(parseISO(monday));
    await widenEndsAndVerify(page, starts, laterEnd);
  });
}
