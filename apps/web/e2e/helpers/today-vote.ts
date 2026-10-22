import { expect, type Locator, type Page, test } from "@playwright/test";
import { enterApp } from "./app";
import { readStoredRows } from "./stored-rows";

const OPEN_VALUED_CARD =
  "main .task-card[data-valued]:not([data-status=done]):not([data-status=skip])";
const HOLD_LANDS_WITHIN_MS = 10_000;

interface StoredTask {
  title: string;
  status: string;
}

interface StoredValue {
  id: string;
  name: string;
  identity?: string;
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const exactly = (text: string) => new RegExp(`^${escapeRegExp(text)}$`);

const remaining = (page: Page) => page.getByRole("region", { name: "Remaining" });
const doneSection = (page: Page) => page.locator("main section[aria-label=Done]");
const announcer = (page: Page) => page.locator("main div.sr-only[aria-live=polite]");
const voteToasts = (page: Page) => page.getByRole("status").filter({ hasText: "A vote for" });

function cardTitled(page: Page, title: string): Locator {
  return page.locator("main .task-card", {
    has: page.locator(".task-card__title-text", { hasText: exactly(title) }),
  });
}

function titleIn(section: Locator, title: string): Locator {
  return section.locator(".task-card__title-text", { hasText: exactly(title) });
}

async function readTitle(card: Locator): Promise<string> {
  return (await card.locator(".task-card__title-text").textContent()) ?? "";
}

async function storedStatus(page: Page, title: string): Promise<string | undefined> {
  const tasks = await readStoredRows<StoredTask>(page, "tasks");
  return tasks.find((task) => task.title === title)?.status;
}

async function openValuedTitles(page: Page, count: number): Promise<string[]> {
  const cards = page.locator(OPEN_VALUED_CARD);
  await expect(cards.first()).toBeVisible({ timeout: 15_000 });
  expect(await cards.count()).toBeGreaterThanOrEqual(count);
  const titles: string[] = [];
  for (let i = 0; i < count; i++) titles.push(await readTitle(cards.nth(i)));
  return titles;
}

async function addTodayTask(page: Page, title: string) {
  await page.getByRole("button", { name: "Add task" }).click();
  await page.getByRole("textbox", { name: "Task title" }).fill(title);
  await page.keyboard.press("Enter");
  await expect(cardTitled(page, title)).toBeVisible();
}

async function expectLandsInDone(page: Page, title: string, timeout = HOLD_LANDS_WITHIN_MS) {
  await expect(titleIn(doneSection(page), title)).toHaveCount(1, { timeout });
  await expect(titleIn(remaining(page), title)).toHaveCount(0);
}

async function setIdentityLine(page: Page, valueName: string, identity: string) {
  const values = await readStoredRows<StoredValue>(page, "values");
  const value = values.find((row) => row.name === valueName);
  expect(value, `stored value ${valueName}`).toBeDefined();
  await page.goto(`/values/${value?.id}`, { waitUntil: "domcontentloaded" });
  const field = page.getByRole("textbox", { name: "Identity line" });
  await expect(field).toHaveAttribute("placeholder", "You're someone who moves.");
  await expect(field).toHaveAttribute("maxlength", "120");
  await field.fill(identity);
  await expect
    .poll(async () => {
      const rows = await readStoredRows<StoredValue>(page, "values");
      return rows.find((row) => row.id === value?.id)?.identity;
    })
    .toBe(identity);
  await page.goto("/today", { waitUntil: "domcontentloaded" });
}

async function setStatusFromEditor(page: Page, card: Locator, status: string) {
  await card.locator(".task-card__body").click();
  const dialog = page.getByRole("dialog", { name: "Edit task" });
  await dialog.getByRole("button", { name: status, exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
}

async function readFocusedLabel(page: Page): Promise<string | null> {
  return page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? null);
}

/** Registers the done-moment specs; one file per Playwright project runs them. */
export function describeVoteMoment() {
  test.beforeEach(async ({ page }) => {
    await enterApp(page);
    await page.goto("/today", { waitUntil: "domcontentloaded" });
  });

  test("a valued complete shows the vote, then lands in Done", async ({ page }) => {
    const [title] = await openValuedTitles(page, 1);
    const card = cardTitled(page, title);
    await card.getByRole("button", { name: `Mark ${title} done` }).click();

    await expect(card).toHaveAttribute("data-vote", "");
    const headline = card.locator(".task-card__headline");
    await expect(headline).toHaveText(/^A vote for \S/);
    await expect(headline).toHaveCSS("opacity", "1");
    await expect(announcer(page)).toHaveText(/^Done\. A vote for /);
    await expect.poll(() => storedStatus(page, title)).toBe("done");

    await page.waitForTimeout(1000);
    await expect(titleIn(doneSection(page), title)).toHaveCount(0);
    await expect(voteToasts(page)).toHaveCount(0);

    await expectLandsInDone(page, title);
    await expect(voteToasts(page)).toHaveCount(0);
  });

  test("undo during the hold keeps the row in Remaining", async ({ page }) => {
    const [title] = await openValuedTitles(page, 1);
    const card = cardTitled(page, title);
    await card.getByRole("button", { name: `Mark ${title} done` }).click();
    await expect(card).toHaveAttribute("data-vote", "");

    await card.getByRole("button", { name: `Mark ${title} not done` }).click();
    await expect(announcer(page)).toHaveText(`${title}, not done`);
    await page.waitForTimeout(3500);
    await expect(titleIn(remaining(page), title)).toHaveCount(1);
    await expect(titleIn(doneSection(page), title)).toHaveCount(0);
    expect(await storedStatus(page, title)).toBe("todo");
  });

  test("an unvalued task completes with no message", async ({ page }) => {
    const title = "Water the plants";
    await addTodayTask(page, title);
    const card = cardTitled(page, title);
    await expect(card).not.toHaveAttribute("data-valued");

    await card.getByRole("button", { name: `Mark ${title} done` }).click();
    await expect(announcer(page)).toHaveText("Done.");
    await expect(card.locator(".task-card__message")).toHaveCount(0);
    await expect(card).not.toHaveAttribute("data-vote");
    await expectLandsInDone(page, title, 5000);
  });

  test("reduced motion still shows the vote, with fades", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const [title] = await openValuedTitles(page, 1);
    const card = cardTitled(page, title);
    await card.getByRole("button", { name: `Mark ${title} done` }).click();

    const discAnimations = await card
      .locator(".task-card__disc")
      .evaluate((disc) =>
        disc
          .getAnimations()
          .map((a) => `${(a as CSSAnimation).animationName}:${a.effect?.getTiming().duration}`),
      );
    expect(discAnimations).toEqual(["done-fade:120"]);
    await expect(card.locator(".task-card__headline")).toHaveCSS("opacity", "1");
    await expect(card.locator(".task-card__flood")).toHaveCSS("clip-path", "none");
    await expectLandsInDone(page, title);
  });

  test("the identity line round-trips from the value page", async ({ page }) => {
    const [title] = await openValuedTitles(page, 1);
    const card = cardTitled(page, title);
    const headline = card.locator(".task-card__headline");
    const valueName = ((await headline.textContent()) ?? "").replace(/^A vote for /, "");
    const identity = "You're someone who moves.";

    await setIdentityLine(page, valueName, identity);
    await card.getByRole("button", { name: `Mark ${title} done` }).click();
    await expect(card.locator(".task-card__identity")).toHaveText(identity);
    await expect(announcer(page)).toHaveText(`Done. A vote for ${valueName}. ${identity}`);
    await card.getByRole("button", { name: `Mark ${title} not done` }).click();

    await setIdentityLine(page, valueName, "");
    await card.getByRole("button", { name: `Mark ${title} done` }).click();
    await expect(headline).toHaveCSS("opacity", "1");
    await expect(card.locator(".task-card__identity")).toHaveCount(0);
    const [cardBox, headlineBox] = await Promise.all([card.boundingBox(), headline.boundingBox()]);
    const cardCentre = (cardBox?.y ?? 0) + (cardBox?.height ?? 0) / 2;
    const headlineCentre = (headlineBox?.y ?? 0) + (headlineBox?.height ?? 0) / 2;
    expect(Math.abs(cardCentre - headlineCentre)).toBeLessThanOrEqual(1);
  });

  test("back-to-back votes show together and leave together", async ({ page }) => {
    const [first, second] = await openValuedTitles(page, 2);
    await cardTitled(page, first)
      .getByRole("button", { name: `Mark ${first} done` })
      .click();
    await cardTitled(page, second)
      .getByRole("button", { name: `Mark ${second} done` })
      .click();

    await expect(cardTitled(page, first)).toHaveAttribute("data-vote", "");
    await expect(cardTitled(page, second)).toHaveAttribute("data-vote", "");
    await expectLandsInDone(page, first);
    await expectLandsInDone(page, second);
  });

  test("every valued complete votes, and no vote toast appears", async ({ page }) => {
    const titles = await openValuedTitles(page, 3);
    for (const title of titles) {
      const card = cardTitled(page, title);
      await card.getByRole("button", { name: `Mark ${title} done` }).click();
      await expect(card).toHaveAttribute("data-vote", "");
    }
    await expect(voteToasts(page)).toHaveCount(0);
    for (const title of titles) await expectLandsInDone(page, title);
    await expect(voteToasts(page)).toHaveCount(0);
  });

  test("setting To do from the editor mid-hold stops the card reading as done", async ({
    page,
  }) => {
    const [title] = await openValuedTitles(page, 1);
    const card = cardTitled(page, title);
    await card.getByRole("button", { name: `Mark ${title} done` }).click();
    await expect(card).toHaveAttribute("data-vote", "");

    await setStatusFromEditor(page, card, "To do");
    await expect(card).toHaveAttribute("data-status", "todo", { timeout: 500 });
    await expect(card).not.toHaveAttribute("data-anim", { timeout: 500 });
    await expect(card).not.toHaveAttribute("data-vote", { timeout: 500 });
    await expect(card.locator(".task-card__disc")).toHaveCSS(
      "transform",
      "matrix(0, 0, 0, 0, 0, 0)",
    );
    await page.waitForTimeout(3500);
    await expect(titleIn(remaining(page), title)).toHaveCount(1);
    expect(await storedStatus(page, title)).toBe("todo");
  });

  test("skipping from the editor mid-hold sends the row to Done at once", async ({ page }) => {
    const [title] = await openValuedTitles(page, 1);
    const card = cardTitled(page, title);
    await card.getByRole("button", { name: `Mark ${title} done` }).click();
    await expect(card).toHaveAttribute("data-vote", "");

    await setStatusFromEditor(page, card, "Skipped");
    await expect(titleIn(doneSection(page), title)).toHaveCount(1, { timeout: 1000 });
    await expect(titleIn(remaining(page), title)).toHaveCount(0);
    await expect(card).toHaveAttribute("data-status", "skip");
    await expect(card).not.toHaveAttribute("data-anim");
  });

  test("the check keeps keyboard focus as its row moves to Done and back", async ({ page }) => {
    const [title] = await openValuedTitles(page, 1);
    const card = cardTitled(page, title);
    await card.getByRole("button", { name: `Mark ${title} done` }).focus();
    await page.keyboard.press("Space");
    await expect(card).toHaveAttribute("data-vote", "");

    await expectLandsInDone(page, title);
    await expect.poll(() => readFocusedLabel(page)).toBe(`Mark ${title} not done`);

    await page.keyboard.press("Space");
    await expect(titleIn(remaining(page), title)).toHaveCount(1);
    await expect.poll(() => readFocusedLabel(page)).toBe(`Mark ${title} done`);
  });

  test("two identical announcements in a row are both announced", async ({ page }) => {
    const titles = ["Water the plants", "Post the letter"];
    await addTodayTask(page, titles[0]);
    await page.getByRole("textbox", { name: "Task title" }).fill(titles[1]);
    await page.keyboard.press("Enter");
    await expect(cardTitled(page, titles[1])).toBeVisible();
    await announcer(page).evaluate((region) => {
      const heard: string[] = [];
      (window as unknown as { __heard: string[] }).__heard = heard;
      new MutationObserver((records) => {
        for (const record of records)
          for (const node of record.addedNodes) heard.push(node.textContent ?? "");
      }).observe(region, { childList: true, subtree: true, characterData: true });
    });

    for (const title of titles)
      await cardTitled(page, title)
        .getByRole("button", { name: `Mark ${title} done` })
        .click();
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __heard: string[] }).__heard))
      .toEqual(["Done.", "Done."]);
  });

  test("completing a skipped valued task in place announces no vote", async ({ page }) => {
    const [title] = await openValuedTitles(page, 1);
    const card = cardTitled(page, title);
    await card.getByRole("button", { name: `Actions for ${title}` }).click();
    await page.getByRole("menuitem", { name: "Skip" }).click();
    await expect(titleIn(doneSection(page), title)).toHaveCount(1);

    await card.getByRole("button", { name: `Mark ${title} done` }).click();
    await expect(card).toHaveAttribute("data-status", "done");
    await expect(announcer(page)).toHaveText("Done.");
    await expect(card).not.toHaveAttribute("data-vote");
  });

  test("the Daily-habits strip keeps its vote toast", async ({ page }) => {
    const strip = page.getByRole("region", { name: "Daily habits" });
    await strip.getByRole("button", { name: "Mark Drink water done" }).click();
    await expect(voteToasts(page)).toHaveText(/A vote for Self-care/);
  });

  test("a complete pulses the haptic at most once per 80ms, and undo never does", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const counter = window as unknown as { __pulses: number };
      counter.__pulses = 0;
      Object.defineProperty(navigator, "vibrate", {
        configurable: true,
        value: () => {
          counter.__pulses += 1;
          return true;
        },
      });
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    const [first, second, third] = await openValuedTitles(page, 3);
    const pulses = () => page.evaluate(() => (window as unknown as { __pulses: number }).__pulses);

    await page.evaluate(
      (labels) => {
        for (const label of labels)
          document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)?.click();
      },
      [`Mark ${first} done`, `Mark ${second} done`],
    );
    expect(await pulses()).toBe(1);

    await page.waitForTimeout(200);
    await cardTitled(page, third)
      .getByRole("button", { name: `Mark ${third} done` })
      .click();
    expect(await pulses()).toBe(2);

    await page.waitForTimeout(200);
    await cardTitled(page, third)
      .getByRole("button", { name: `Mark ${third} not done` })
      .click();
    expect(await pulses()).toBe(2);
  });
}
