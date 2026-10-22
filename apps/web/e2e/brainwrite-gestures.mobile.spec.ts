import { expect, type Page, test } from "@playwright/test";
import { skipGratitudePage } from "./helpers/app";
import {
  cancelTouch,
  dragAlong,
  endTouch,
  longPress,
  measureCardAnchors,
  moveTouch,
  projectFlick,
  startSwipe,
  startTouch,
  swipe,
  swipeThenHold,
  type TouchFinger,
  tap,
} from "./helpers/touch";

/**
 * Real-touch reproduction of the BrainWrite gesture defects (run decisions R10).
 * The `.mobile.spec.ts` suffix routes this into the Pixel 7 / `hasTouch` project.
 *
 * Several of these are RED on purpose — they are the proof the defects exist. Never
 * soften an assertion here to get green; the table in
 * `docs/runs/2026-08-20-brainwrite-gestures/evidence/e2e-red.md` records what each
 * one actually does.
 */

const DECK = "[data-brainwrite-scroll]";
const DECK_SIZE = 6;
const SEED_BOX = 2;
/** Long enough for a grade to reach Dexie and for the 260ms fly-off + 700ms recentre. */
const SETTLE_MS = 1_200;
const LONG_PRESS_MS = 500;
/** A nav destination that is neither the current route nor an overlay trigger. */
const NAV_PROBE_LABEL = "Habits";

interface DeckCardState {
  id: string;
  box: number | null;
  reviewCount: number;
  nextDue: string | null;
  lastReviewed: string | null;
}

const announcerOf = (page: Page) => page.locator("[data-brainwrite-announcer]");
const cardAt = (page: Page, index: number) => page.locator(`[data-index="${index}"] article`);
const sheetOf = (page: Page) => page.getByRole("dialog", { name: "Card actions" });

const countGrades = (deck: DeckCardState[]): number =>
  deck.reduce((total, card) => total + card.reviewCount, 0);

const worstRepeat = (deck: DeckCardState[]): number =>
  deck.reduce((worst, card) => Math.max(worst, card.reviewCount), 0);

/** A known deck of due, flippable cards, written straight into the sandbox's Dexie store. */
async function seedDeck(page: Page) {
  await page.evaluate(
    async (setup) => {
      const pad = (value: number) => String(value).padStart(2, "0");
      const now = new Date();
      const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("vega-life-os");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise<void>((resolve, reject) => {
        const tx = database.transaction(["cards", "cardPrefs", "mindCards"], "readwrite");
        const cards = tx.objectStore("cards");
        cards.clear();
        tx.objectStore("mindCards").clear();
        for (let n = 1; n <= setup.size; n += 1) {
          cards.put({
            id: `c_e2e_bw_${n}`,
            type: "note",
            category: "E2E",
            title: `Deck card ${n}`,
            body: `The reveal side of deck card ${n}.`,
            author: null,
            work: null,
            locator: null,
            phonetic: null,
            language: null,
            examples: [],
            synonyms: [],
            hasRecall: false,
            addedAt: today,
            hiddenAt: null,
            likedAt: null,
            box: setup.box,
            lastReviewed: null,
            nextDue: today,
            reviewCount: 0,
            updatedAt: "",
            fieldUpdatedAt: {},
          });
        }
        tx.objectStore("cardPrefs").put({
          id: "feed",
          mode: "mix",
          types: [],
          categories: [],
          view: "rows",
          migratedAt: today,
          updatedAt: "",
          fieldUpdatedAt: {},
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      database.close();
    },
    { size: DECK_SIZE, box: SEED_BOX },
  );
}

async function readDeckState(page: Page): Promise<DeckCardState[]> {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("vega-life-os");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const rows = await new Promise<Record<string, unknown>[]>((resolve, reject) => {
      const request = database.transaction("cards", "readonly").objectStore("cards").getAll();
      request.onsuccess = () => resolve(request.result as Record<string, unknown>[]);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return rows
      .filter((row) => String(row.id).startsWith("c_e2e_bw_"))
      .map((row) => ({
        id: String(row.id),
        box: row.box as number | null,
        reviewCount: row.reviewCount as number,
        nextDue: row.nextDue as string | null,
        lastReviewed: row.lastReviewed as string | null,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
  });
}

/**
 * `enterApp`'s networkidle boot goes flaky on a cold dev server under parallel workers —
 * mobile.spec.ts already boots on element waits for the same reason.
 */
async function bootSandbox(page: Page) {
  await skipGratitudePage(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const explore = page.getByRole("button", { name: /explore with sample data/i });
  const main = page.locator("main");
  await expect(explore.or(main)).toBeVisible({ timeout: 20_000 });
  if (await explore.isVisible().catch(() => false)) {
    await explore.click();
    await expect(main).toBeVisible({ timeout: 15_000 });
  }
}

async function openBrainWrite(page: Page) {
  await bootSandbox(page);
  await seedDeck(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.goto("/brainwrite", { waitUntil: "domcontentloaded" });
  await expect(page.locator(DECK)).toBeVisible({ timeout: 15_000 });
  await expect(cardAt(page, 0)).toBeVisible({ timeout: 15_000 });
  // The stage measures itself through a ResizeObserver; until it has, cardWidthPx is 0.
  await page.waitForTimeout(500);
}

/** Nothing in the deck was graded — the assertion behind every "must not grade" case. */
async function expectNoGrade(page: Page, why: string) {
  await page.waitForTimeout(SETTLE_MS);
  const deck = await readDeckState(page);
  expect(countGrades(deck), why).toBe(0);
}

async function readDeckScrollTop(page: Page): Promise<number> {
  return page.locator(DECK).evaluate((node) => node.scrollTop);
}

/** A horizontal path across the centre of the card, well clear of both edge dead zones. */
function crossCardPath(anchors: { centre: TouchFinger; width: number }, direction: 1 | -1) {
  const travel = anchors.width * 0.5;
  return {
    from: { x: anchors.centre.x - (direction * travel) / 2, y: anchors.centre.y },
    to: { x: anchors.centre.x + (direction * travel) / 2, y: anchors.centre.y },
  };
}

/**
 * The two halves of the nav's box that D2 separates: a real 44px tap target, which still
 * owns any touch that starts on it, and the container's own bottom padding, which stopped
 * swallowing touches when the container went `pointer-events-none`.
 */
async function measureNavBands(page: Page, buttonLabel: string) {
  const nav = page.locator("[data-bottom-nav]");
  const navBox = await nav.boundingBox();
  const buttonBox = await nav.getByRole("button", { name: buttonLabel, exact: true }).boundingBox();
  if (navBox === null || buttonBox === null) throw new Error("the bottom nav has no bounding box");
  const buttonBottomY = buttonBox.y + buttonBox.height;
  const navBottomY = navBox.y + navBox.height;
  return {
    buttonCentre: { x: buttonBox.x + buttonBox.width / 2, y: buttonBox.y + buttonBox.height / 2 },
    freedBandCentreY: (buttonBottomY + navBottomY) / 2,
    freedBandHeight: navBottomY - buttonBottomY,
  };
}

test("a horizontal swipe right grades the card remembered", async ({ page }) => {
  await openBrainWrite(page);
  const anchors = await measureCardAnchors(cardAt(page, 0));
  const path = crossCardPath(anchors, 1);

  await swipe(page, { ...path, durationMs: 250, steps: 10 });

  await expect(announcerOf(page)).toContainText("Remembered", { timeout: 5_000 });
  await expect
    .poll(async () => (await readDeckState(page))[0], { timeout: 5_000 })
    .toMatchObject({ box: SEED_BOX + 1, reviewCount: 1 });
});

test("a horizontal swipe left grades the card not-quite", async ({ page }) => {
  await openBrainWrite(page);
  const anchors = await measureCardAnchors(cardAt(page, 0));
  const path = crossCardPath(anchors, -1);

  await swipe(page, { ...path, durationMs: 250, steps: 10 });

  await expect(announcerOf(page)).toContainText("Not remembered", { timeout: 5_000 });
  await expect
    .poll(async () => (await readDeckState(page))[0], { timeout: 5_000 })
    .toMatchObject({ box: 1, reviewCount: 1 });
});

test("a vertical page swipe advances the deck and grades nothing", async ({ page }) => {
  await openBrainWrite(page);
  const anchors = await measureCardAnchors(cardAt(page, 0));

  await swipe(page, {
    from: { x: anchors.centre.x, y: anchors.centre.y + anchors.height * 0.25 },
    to: { x: anchors.centre.x, y: anchors.centre.y - anchors.height * 0.25 },
    durationMs: 300,
    steps: 12,
  });

  await expect.poll(() => readDeckScrollTop(page), { timeout: 5_000 }).toBeGreaterThan(0);
  await expectNoGrade(page, "a vertical page swipe graded a card");
});

test("a diagonal flick 12 degrees off vertical at 800px/s grades nothing", async ({ page }) => {
  await openBrainWrite(page);
  const anchors = await measureCardAnchors(cardAt(page, 0));
  const from = { x: anchors.centre.x, y: anchors.centre.y + anchors.height * 0.2 };

  await swipe(page, {
    from,
    to: projectFlick(from, { degreesOffVertical: 12, speedPxPerSec: 800, durationMs: 400 }),
    durationMs: 400,
    steps: 16,
  });

  await expectNoGrade(page, "a 12-degree-off-vertical flick at 800px/s graded a card");
});

test("a fast diagonal flick 12 degrees off vertical at 3000px/s grades nothing", async ({
  page,
}) => {
  await openBrainWrite(page);
  const anchors = await measureCardAnchors(cardAt(page, 0));
  const from = { x: anchors.centre.x, y: anchors.centre.y + anchors.height * 0.3 };

  // 3000px/s is an ordinary one-handed thumb flick, and 12° off vertical carries
  // 624px/s of purely incidental horizontal velocity — past the 500px/s commit gate.
  await swipe(page, {
    from,
    to: projectFlick(from, { degreesOffVertical: 12, speedPxPerSec: 3000, durationMs: 160 }),
    durationMs: 160,
    steps: 8,
  });

  await expectNoGrade(page, "a 12-degree-off-vertical flick at 3000px/s graded a card");
});

test("a diagonal flick 30 degrees off vertical at 1100px/s grades nothing", async ({ page }) => {
  await openBrainWrite(page);
  const anchors = await measureCardAnchors(cardAt(page, 0));
  const from = { x: anchors.centre.x, y: anchors.centre.y + anchors.height * 0.25 };

  // What an ordinary one-handed thumb produces: 30° off vertical carries ~550px/s of
  // horizontal velocity, past the 500px/s gate, on a gesture that is plainly a page swipe.
  await swipe(page, {
    from,
    to: projectFlick(from, { degreesOffVertical: 30, speedPxPerSec: 1100, durationMs: 400 }),
    durationMs: 400,
    steps: 16,
  });

  await expectNoGrade(page, "a 30-degree-off-vertical flick at 1100px/s graded a card");
});

test("a thumb arc — sideways nudge, then a vertical flick — grades nothing", async ({ page }) => {
  await openBrainWrite(page);
  const anchors = await measureCardAnchors(cardAt(page, 0));
  const base = { x: anchors.centre.x, y: anchors.centre.y + anchors.height * 0.25 };
  const nudged = { x: base.x + 40, y: base.y };

  // The 40px sideways nudge takes the gesture away from `touch-action: pan-y`, so the
  // vertical flick that follows reaches framer instead of scrolling the deck. The flick
  // travels ~417px up and ~112px across: dominantly vertical, under the 0.4-width
  // distance gate, and carrying ~621px/s of incidental horizontal velocity.
  await startTouch(page, base);
  await dragAlong(page, { from: base, to: nudged, durationMs: 200, steps: 10 });
  await dragAlong(page, {
    from: nudged,
    to: projectFlick(nudged, { degreesOffVertical: 15, speedPxPerSec: 2400, durationMs: 180 }),
    durationMs: 180,
    steps: 9,
  });
  await endTouch(page);

  await expectNoGrade(page, "a dominantly-vertical thumb arc graded a card");
});

test("a tap flips the card", async ({ page }) => {
  await openBrainWrite(page);
  const card = cardAt(page, 0);
  const anchors = await measureCardAnchors(card);

  await tap(page, anchors.centre);

  await expect(card.locator("[data-brainwrite-flip]")).toHaveAttribute(
    "data-brainwrite-flip",
    "reveal",
    { timeout: 5_000 },
  );
});

test("a short drag does not flip the card when it is released", async ({ page }) => {
  await openBrainWrite(page);
  const card = cardAt(page, 0);
  const anchors = await measureCardAnchors(card);

  // 6px: past framer's 3px drag activation, inside Chromium's tap slop, so the
  // browser still fires the click that would flip.
  await swipe(page, {
    from: anchors.centre,
    to: { x: anchors.centre.x + 6, y: anchors.centre.y },
    durationMs: 200,
    steps: 3,
  });

  await page.waitForTimeout(SETTLE_MS);
  await expect(card.locator("[data-brainwrite-flip]")).toHaveAttribute(
    "data-brainwrite-flip",
    "face",
  );
});

test("a long press opens the card sheet", async ({ page }) => {
  await openBrainWrite(page);
  const anchors = await measureCardAnchors(cardAt(page, 0));

  await longPress(page, anchors.centre, { holdMs: 700 });

  await expect(sheetOf(page)).toBeVisible({ timeout: 5_000 });
});

test("a drag that follows a fired long press grades nothing", async ({ page }) => {
  await openBrainWrite(page);
  const anchors = await measureCardAnchors(cardAt(page, 0));
  const path = crossCardPath(anchors, 1);

  await startTouch(page, path.from);
  await page.waitForTimeout(LONG_PRESS_MS + 200);
  await expect(sheetOf(page)).toBeVisible({ timeout: 5_000 });
  await dragAlong(page, { ...path, durationMs: 250, steps: 10 });
  await endTouch(page);

  await expectNoGrade(page, "a drag after the sheet opened still graded the card");
});

test("a slow swipe that trips the long-press timer opens no sheet", async ({ page }) => {
  await openBrainWrite(page);
  const anchors = await measureCardAnchors(cardAt(page, 0));
  const path = crossCardPath(anchors, 1);
  const creep = { x: path.from.x + 5, y: path.from.y };

  // 5px crosses framer's 3px activation but stays inside useLongPress's 10px cancel
  // tolerance, so the press timer is still armed when it fires at 500ms.
  await startTouch(page, path.from);
  await dragAlong(page, { from: path.from, to: creep, durationMs: 120, steps: 3 });
  await page.waitForTimeout(LONG_PRESS_MS + 150);
  await dragAlong(page, { from: creep, to: path.to, durationMs: 250, steps: 10 });
  await endTouch(page);

  await expect(sheetOf(page)).toBeHidden();
});

test("a swipe starting inside the edge dead zone reports itself", async ({ page }) => {
  await openBrainWrite(page);
  const anchors = await measureCardAnchors(cardAt(page, 0), 8);

  // Held at rest before release, so this commits on distance alone — no velocity path.
  await swipeThenHold(
    page,
    {
      from: anchors.leftEdgeInset,
      to: { x: anchors.leftEdgeInset.x + anchors.width * 0.55, y: anchors.leftEdgeInset.y },
      // Deliberately slow: framer starts the drag 3px in, and a fast path would already
      // be past the 24px dead zone by the time the start point is sampled.
      durationMs: 1_200,
      steps: 30,
    },
    150,
  );

  await page.waitForTimeout(SETTLE_MS);
  const deck = await readDeckState(page);
  expect(countGrades(deck), "an edge-zone swipe graded the card").toBe(0);
  // R7: a voided drag springs back with feedback — silence is the defect.
  await expect(announcerOf(page)).not.toBeEmpty();
});

test("a second swipe during the fly-off does not double-grade the card", async ({ page }) => {
  await openBrainWrite(page);
  const anchors = await measureCardAnchors(cardAt(page, 0));
  const path = crossCardPath(anchors, 1);

  await swipe(page, { ...path, durationMs: 200, steps: 8 });
  await page.waitForTimeout(60);
  await swipe(page, { ...path, durationMs: 150, steps: 6 });

  await page.waitForTimeout(SETTLE_MS);
  const deck = await readDeckState(page);
  expect(deck[0].reviewCount, "the card was graded twice inside its exit window").toBe(1);
});

test("repeated fast wrong grades do not run the review count away", async ({ page }) => {
  await openBrainWrite(page);
  const anchors = await measureCardAnchors(cardAt(page, 0));
  const path = crossCardPath(anchors, -1);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await swipe(page, { ...path, durationMs: 150, steps: 6 });
    await page.waitForTimeout(60);
  }

  await page.waitForTimeout(SETTLE_MS);
  const deck = await readDeckState(page);
  expect(worstRepeat(deck), "one card absorbed more than one wrong grade").toBeLessThanOrEqual(1);
});

test("a pointercancel mid-drag leaves the store untouched", async ({ page }) => {
  await openBrainWrite(page);
  const anchors = await measureCardAnchors(cardAt(page, 0));
  const path = crossCardPath(anchors, 1);

  await startSwipe(page, { ...path, durationMs: 200, steps: 8 });
  await cancelTouch(page);

  await expectNoGrade(page, "a cancelled gesture graded the card");
});

test("a second finger mid-drag opens no sheet and flips nothing", async ({ page }) => {
  await openBrainWrite(page);
  const card = cardAt(page, 0);
  const anchors = await measureCardAnchors(card);
  const primary = { x: anchors.centre.x - 40, y: anchors.centre.y, id: 1 };
  const secondary = { x: anchors.centre.x + 60, y: anchors.centre.y + 80, id: 2 };

  await startTouch(page, primary);
  await dragAlong(page, {
    from: primary,
    to: { ...primary, x: primary.x + 40 },
    durationMs: 200,
    steps: 6,
  });
  const dragged = { ...primary, x: primary.x + 40 };
  await startTouch(page, [dragged, secondary]);
  await page.waitForTimeout(LONG_PRESS_MS + 200);
  await endTouch(page, [dragged]);
  await endTouch(page);

  await expect(sheetOf(page)).toBeHidden();
  await expect(card.locator("[data-brainwrite-flip]")).toHaveAttribute(
    "data-brainwrite-flip",
    "face",
  );
});

test("a swipe with the sheet open grades nothing", async ({ page }) => {
  await openBrainWrite(page);
  const anchors = await measureCardAnchors(cardAt(page, 0));

  await longPress(page, anchors.centre, { holdMs: 700 });
  await expect(sheetOf(page)).toBeVisible({ timeout: 5_000 });

  await swipe(page, {
    from: { x: anchors.centre.x - anchors.width * 0.25, y: anchors.upperMiddle.y },
    to: { x: anchors.centre.x + anchors.width * 0.25, y: anchors.upperMiddle.y },
    durationMs: 250,
    steps: 10,
  });

  await expectNoGrade(page, "a swipe behind the open sheet graded the card");
});

test("a deck rebuild mid-drag does not add a second grade", async ({ page }) => {
  await openBrainWrite(page);
  const anchors = await measureCardAnchors(cardAt(page, 0));
  const path = crossCardPath(anchors, 1);
  await page.locator(DECK).focus();

  await startSwipe(page, { ...path, durationMs: 200, steps: 8 });
  // A wrong keyboard grade writes `cards` — rebuilding the queue tail under the live
  // finger — and leaves the card gradeable, so nothing but the view can stop a repeat.
  await page.keyboard.press("2");
  await page.waitForTimeout(120);
  await moveTouch(page, path.to);
  await endTouch(page);

  await page.waitForTimeout(SETTLE_MS);
  const deck = await readDeckState(page);
  expect(deck[0].reviewCount, "the rebuild let the same card grade twice").toBe(1);
});

test("reduced motion still shows the commit feedback and still grades", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openBrainWrite(page);
  const card = cardAt(page, 0);
  const anchors = await measureCardAnchors(card);
  const path = crossCardPath(anchors, 1);

  await startSwipe(page, { ...path, durationMs: 250, steps: 10 });
  const glowOpacity = await card
    .locator('> div[aria-hidden="true"]')
    .first()
    .evaluate((node) => Number(getComputedStyle(node).opacity));
  await endTouch(page);

  await expect
    .poll(async () => (await readDeckState(page))[0].reviewCount, { timeout: 5_000 })
    .toBe(1);
  expect(glowOpacity, "no commit feedback at the threshold under reduced motion").toBeGreaterThan(
    0,
  );
});

test("a swipe starting on a bottom-nav button grades nothing and stays put", async ({ page }) => {
  await openBrainWrite(page);
  const anchors = await measureCardAnchors(cardAt(page, 0));
  const nav = await measureNavBands(page, NAV_PROBE_LABEL);
  const to = { x: nav.buttonCentre.x + anchors.width * 0.5, y: nav.buttonCentre.y };

  // The path would grade comfortably if it reached the card: half the card's width,
  // dead flat, starting clear of the edge void.
  await swipe(page, { from: nav.buttonCentre, to, durationMs: 250, steps: 10 });

  await expect(page).toHaveURL(/\/brainwrite$/);
  await expectNoGrade(page, "a swipe from a nav button graded the card");
});

test("a swipe starting in the band below the nav buttons reaches the card", async ({ page }) => {
  await openBrainWrite(page);
  const anchors = await measureCardAnchors(cardAt(page, 0));
  const nav = await measureNavBands(page, NAV_PROBE_LABEL);
  const path = crossCardPath(anchors, 1);
  const from = { x: path.from.x, y: nav.freedBandCentreY };

  expect(nav.freedBandHeight, "the nav's button row leaves no band below it").toBeGreaterThan(0);

  await swipe(page, { from, to: { x: path.to.x, y: from.y }, durationMs: 250, steps: 10 });

  await expect(announcerOf(page)).toContainText("Remembered", { timeout: 5_000 });
  await expect
    .poll(async () => (await readDeckState(page))[0], { timeout: 5_000 })
    .toMatchObject({ box: SEED_BOX + 1, reviewCount: 1 });
});

test("a tap on a bottom-nav button still navigates", async ({ page }) => {
  await openBrainWrite(page);
  const nav = await measureNavBands(page, NAV_PROBE_LABEL);

  await tap(page, nav.buttonCentre);

  await expect(page).toHaveURL(/\/habits$/);
});
