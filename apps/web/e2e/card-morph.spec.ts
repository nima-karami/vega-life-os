import { expect, type Page } from "@playwright/test";
import { test } from "./fixtures";
import { enterApp } from "./helpers/app";

/**
 * Card → page "disc carries": a value, goal or habit card opens its page through a view
 * transition that carries the card's fill, icon and title into the page header, and Back
 * replays it in reverse. Everything else (and every browser without View Transitions, or
 * under reduced motion) gets the plain route fade.
 */

type MorphRecord = {
  started: number;
  names: string[];
  directions: string[];
  orphans: number;
  finished: number;
  fillArrivalOpacity: string[];
};

/** Wraps startViewTransition to count transitions and record the names captured in each. */
async function recordViewTransitions(page: Page) {
  await page.addInitScript(() => {
    const record: MorphRecord = {
      started: 0,
      names: [],
      directions: [],
      orphans: 0,
      finished: 0,
      fillArrivalOpacity: [],
    };
    Object.assign(window, { __morph: record });
    const original = document.startViewTransition?.bind(document);
    if (!original) return;
    const readNames = () =>
      [...document.querySelectorAll("*")]
        .map((el) => getComputedStyle(el).viewTransitionName)
        .filter((name) => name !== "none");
    document.startViewTransition = ((update: ViewTransitionUpdateCallback) => {
      record.started += 1;
      record.names.push(...readNames());
      const root = document.documentElement;
      const transition = original(async () => {
        await update();
        record.names.push(...readNames());
        if (root.dataset.routeMorph) record.directions.push(root.dataset.routeMorph);
        if (root.dataset.routeMorphOrphan !== undefined) record.orphans += 1;
      });
      const arrival = "::view-transition-new(entity-fill)";
      transition.ready.then(() => {
        for (const animation of document.getAnimations()) {
          if ((animation.effect as KeyframeEffect | null)?.pseudoElement !== arrival) continue;
          const end = Number(animation.effect?.getComputedTiming().endTime ?? 0);
          animation.pause();
          animation.currentTime = end - 1;
          record.fillArrivalOpacity.push(getComputedStyle(root, arrival).opacity);
          animation.play();
        }
      });
      const countFinished = () => {
        record.finished += 1;
      };
      transition.finished.then(countFinished, countFinished);
      return transition;
    }) as typeof document.startViewTransition;
  });
}

/** The record once every started transition has finished. */
async function readMorph(page: Page) {
  const read = () => page.evaluate(() => (window as unknown as { __morph: MorphRecord }).__morph);
  await expect
    .poll(async () => {
      const record = await read();
      return record.finished === record.started;
    })
    .toBe(true);
  return read();
}

async function openHabits(page: Page) {
  await enterApp(page);
  await page.goto("/habits");
  await expect(page.getByRole("heading", { name: "Habits", exact: true })).toBeVisible({
    timeout: 15_000,
  });
}

const habitCard = (page: Page) => page.locator('main a[href^="/habits/"]').first();
const habitName = (page: Page) => page.getByRole("textbox", { name: "Habit name" });
const namedElementCount = (page: Page) =>
  page.evaluate(
    () =>
      [...document.querySelectorAll("*")].filter(
        (el) => getComputedStyle(el).viewTransitionName !== "none",
      ).length,
  );

test("a habit card carries its disc into the page and back again", async ({ page }) => {
  await recordViewTransitions(page);
  await openHabits(page);
  const card = habitCard(page);
  const name = ((await card.textContent()) ?? "").trim();
  const before = await readMorph(page);

  await card.click();
  await expect(habitName(page)).toHaveValue(name);
  const opened = await readMorph(page);
  expect(opened.started).toBe(before.started + 1);
  for (const part of ["entity-fill", "entity-icon", "entity-title", "route-from", "route-to"]) {
    expect(opened.names).toContain(part);
  }
  await expect.poll(() => namedElementCount(page)).toBe(0);
  await expect(page.locator("html")).not.toHaveAttribute("data-route-morph");

  await page.goBack();
  await expect(page.getByRole("heading", { name: "Habits", exact: true })).toBeVisible();
  await expect(habitCard(page)).toBeVisible();
  expect((await readMorph(page)).started).toBe(before.started + 2);
  await expect.poll(() => namedElementCount(page)).toBe(0);
});

test("only the tapped card and its page header carry names", async ({ page }) => {
  await recordViewTransitions(page);
  await openHabits(page);
  await habitCard(page).click();
  await expect(habitName(page)).toBeVisible();
  const { names } = await readMorph(page);
  // Captured once before and once after the swap: one of each part per snapshot.
  expect(names.filter((n) => n === "entity-fill")).toHaveLength(2);
  expect(names.filter((n) => n === "entity-title")).toHaveLength(2);
  expect(names.filter((n) => n === "entity-icon")).toHaveLength(2);
});

test("a goal card opens its goal page from the value page", async ({ page }) => {
  await recordViewTransitions(page);
  await enterApp(page);
  await page.goto("/values");
  const valueCard = page.locator('main a[href^="/values/"]').first();
  await valueCard.click();
  await expect(page).toHaveURL(/\/values\/[^/]+$/);
  const goalCard = page.locator('main a[href^="/goals/"]').first();
  await goalCard.click();
  await expect(page).toHaveURL(/\/goals\/[^/]+$/);
  await expect(page.getByRole("textbox", { name: "Goal name" })).toBeVisible();
  expect((await readMorph(page)).started).toBe(2);
});

test("non-card entry points never start a view transition", async ({ page }) => {
  await recordViewTransitions(page);
  await openHabits(page);
  const href = (await habitCard(page).getAttribute("href")) ?? "";

  await page.goto(href);
  await expect(habitName(page)).toBeVisible();
  await page.getByRole("link", { name: "Values" }).first().click();
  await expect(page).toHaveURL(/\/values$/);
  await page.goBack();
  await expect(habitName(page)).toBeVisible();
  expect((await readMorph(page)).started).toBe(0);
});

test("reduced motion swaps routes with the fade only", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await recordViewTransitions(page);
  await openHabits(page);
  await habitCard(page).click();
  await expect(habitName(page)).toBeVisible();
  await page.goBack();
  await expect(habitCard(page)).toBeVisible();
  expect((await readMorph(page)).started).toBe(0);
});

test("a browser without View Transitions gets the route fade", async ({ page }) => {
  await page.addInitScript(() => {
    Reflect.deleteProperty(Document.prototype, "startViewTransition");
  });
  await openHabits(page);
  expect(await page.evaluate(() => "startViewTransition" in document)).toBe(false);
  await habitCard(page).click();
  await expect(habitName(page)).toBeVisible();
  const layer = page.locator("#main-content > div").first();
  await expect.poll(() => layer.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
  await page.goBack();
  await expect(habitCard(page)).toBeVisible();
});

const readScrollTop = (page: Page) =>
  page.evaluate(() => document.getElementById("main-content")?.scrollTop ?? -1);

/** In-app navigation that is not a card: React Router sees a plain history change. */
const navigateInApp = (page: Page, path: string) =>
  page.evaluate((target) => {
    window.history.pushState({}, "", target);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, path);

test("Back restores the list's scroll onto the opened card; the page opens at the top", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await recordViewTransitions(page);
  await openHabits(page);
  const lastCard = page.locator('main a[href^="/habits/"]').last();
  await lastCard.scrollIntoViewIfNeeded();
  const listScroll = await readScrollTop(page);
  expect(listScroll).toBeGreaterThan(0);

  await lastCard.click();
  await expect(habitName(page)).toBeVisible();
  expect(await readScrollTop(page)).toBe(0);

  await page.goBack();
  await expect(lastCard).toBeVisible();
  await expect.poll(() => readScrollTop(page)).toBe(listScroll);
  expect((await readMorph(page)).directions).toEqual(["open", "back"]);
});

test("a Back React Router replays onto a non-entity page stays a plain fade", async ({ page }) => {
  await recordViewTransitions(page);
  await openHabits(page);
  await habitCard(page).click();
  await expect(habitName(page)).toBeVisible();
  await page.goBack();
  await expect(habitCard(page)).toBeVisible();

  await navigateInApp(page, "/today");
  await expect(page).toHaveURL(/\/today$/);
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Habits", exact: true })).toBeVisible();
  await expect(page.locator("html")).not.toHaveAttribute("data-route-morph");
  const replayed = await readMorph(page);
  // React Router did replay a transition here; it just carried nothing.
  expect(replayed.started).toBe(3);
  expect(replayed.directions).toEqual(["open", "back"]);
  const layer = page.locator("#main-content > div").first();
  await expect.poll(() => layer.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
});

test("Back from a goal opened by its row lets the header fade instead of flying", async ({
  page,
}) => {
  await recordViewTransitions(page);
  await enterApp(page);
  await page.goto("/values");
  await page.locator('main a[href^="/values/"]').first().click();
  await expect(page).toHaveURL(/\/values\/[^/]+$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/values$/);

  await page.locator('main a[href^="/goals/"]').first().click();
  await expect(page.getByRole("textbox", { name: "Goal name" })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/values$/);
  await expect(page.locator("html")).not.toHaveAttribute("data-route-morph-orphan");
  expect((await readMorph(page)).orphans).toBe(1);
});

test("under reduced motion a replayed Back still shows the card's fill", async ({ page }) => {
  await recordViewTransitions(page);
  await openHabits(page);
  await habitCard(page).click();
  await expect(habitName(page)).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goBack();
  await expect(habitCard(page)).toBeVisible();
  const { fillArrivalOpacity } = await readMorph(page);
  expect(Number(fillArrivalOpacity.at(-1))).toBeGreaterThan(0.9);
});
