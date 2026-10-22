import { expect, type Locator, type Page, test } from "@playwright/test";
import { enterApp } from "./app";
import { readStoredRows } from "./stored-rows";

const HABIT = "Drink water";
const VALUE = "Self-care";
const LANDS_WITHIN_MS = 10_000;

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const exactly = (text: string) => new RegExp(`^${escapeRegExp(text)}$`);

const remaining = (page: Page) => page.locator("main section[aria-label=Remaining]");
const doneSection = (page: Page) => page.locator("main section[aria-label=Done]");
const announcer = (page: Page) => page.locator("main div.sr-only[aria-live=polite]");
const anytimeLabel = (page: Page) =>
  remaining(page).getByRole("heading", { name: "Anytime today" });
const voteToasts = (page: Page) => page.getByRole("status").filter({ hasText: "A vote for" });

function slimRow(scope: Locator, title: string): Locator {
  return scope.locator(".task-card[data-density=compact]", {
    has: scope.page().locator(".task-card__title-text", { hasText: exactly(title) }),
  });
}

/** The daily habit repeats every day, so only today's instance counts. */
async function storedStatus(page: Page, title: string): Promise<string | undefined> {
  const today = await page.evaluate(() => {
    const now = new Date();
    const pad = (part: number) => String(part).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  });
  const tasks = await readStoredRows<{ title: string; status: string; date: string | null }>(
    page,
    "tasks",
  );
  return tasks.find((task) => task.title === title && task.date === today)?.status;
}

async function complete(row: Locator, title: string) {
  await row.getByRole("button", { name: `Mark ${title} done` }).click();
}

async function expectLandsInDone(page: Page, title: string) {
  await expect(slimRow(doneSection(page), title)).toHaveCount(1, { timeout: LANDS_WITHIN_MS });
  await expect(slimRow(remaining(page), title)).toHaveCount(0);
}

/** Adds an untimed task from the capture, optionally under a habit (which makes it anytime). */
async function captureTask(page: Page, title: string, picker: { label: string; option: string }) {
  await page.getByRole("button", { name: "Add task" }).click();
  const form = page.getByRole("form", { name: "Add a task" });
  await form.getByRole("textbox", { name: "Task title" }).fill(title);
  await form.getByRole("button", { name: new RegExp(picker.label) }).click();
  await page.getByRole("option", { name: picker.option, exact: true }).click();
  await form.getByRole("textbox", { name: "Task title" }).press("Enter");
  await page.keyboard.press("Escape");
}

/** Settles every card on the list, so only the Anytime rows are left to do. */
async function settleEveryCard(page: Page) {
  const openCheck = remaining(page).locator(
    ".task-card[data-density=card]:not([data-status=done]) .task-card__check",
  );
  while ((await openCheck.count()) > 0) await openCheck.first().click();
  await expect(remaining(page).locator(".task-card[data-density=card]")).toHaveCount(0, {
    timeout: LANDS_WITHIN_MS,
  });
}

/** Registers the Anytime-habit specs; one file per Playwright project runs them. */
export function describeAnytimeHabits() {
  test.beforeEach(async ({ page }) => {
    await enterApp(page);
    await page.goto("/today", { waitUntil: "domcontentloaded" });
    await expect(slimRow(remaining(page), HABIT)).toBeVisible({ timeout: 15_000 });
  });

  test("an anytime habit is a slim row that votes, then lands in Done", async ({ page }) => {
    await expect(page.getByRole("region", { name: "Daily habits" })).toHaveCount(0);
    await expect(anytimeLabel(page)).toBeVisible();
    const row = slimRow(remaining(page), HABIT);
    await expect(row.getByText(VALUE, { exact: true })).toBeVisible();
    await complete(row, HABIT);

    await expect(row).toHaveAttribute("data-vote", "");
    const headline = row.locator(".task-card__headline");
    await expect(headline).toHaveText(`A vote for ${VALUE}`);
    await expect(headline).toHaveCSS("opacity", "1");
    await expect(announcer(page)).toHaveText(new RegExp(`^Done\\. A vote for ${VALUE}\\.`));
    await expect.poll(() => storedStatus(page, HABIT)).toBe("done");

    await page.waitForTimeout(1000);
    await expect(slimRow(doneSection(page), HABIT)).toHaveCount(0);
    await expectLandsInDone(page, HABIT);
    await expect(slimRow(doneSection(page), HABIT)).toHaveAttribute("data-status", "done");
    await expect(anytimeLabel(page)).toHaveAttribute("data-collapsed", "true");
    await expect(voteToasts(page)).toHaveCount(0);
  });

  test("a second vote for a value still on screen says 'Another vote'", async ({ page }) => {
    await captureTask(page, "Stretch", { label: "Habit", option: HABIT });
    const second = slimRow(remaining(page), "Stretch");
    await expect(second).toBeVisible();

    await complete(slimRow(remaining(page), HABIT), HABIT);
    await complete(second, "Stretch");

    await expect(slimRow(remaining(page), HABIT).locator(".task-card__headline")).toHaveText(
      `A vote for ${VALUE}`,
    );
    await expect(second).toHaveAttribute("data-vote", "");
    await expect(second.locator(".task-card__headline")).toHaveText(`Another vote for ${VALUE}`);
    await expect(second.locator(".task-card__identity")).toHaveCount(0);
    await expect(announcer(page)).toHaveText(`Done. Another vote for ${VALUE}.`);
    await expectLandsInDone(page, HABIT);
    await expectLandsInDone(page, "Stretch");
  });

  test("a card voting for a value already on screen says 'Another vote' too", async ({ page }) => {
    const title = "Floss";
    await captureTask(page, title, { label: "Value", option: VALUE });
    const card = remaining(page).locator(".task-card[data-density=card]", {
      has: page.locator(".task-card__title-text", { hasText: exactly(title) }),
    });
    await expect(card).toBeVisible();

    await complete(slimRow(remaining(page), HABIT), HABIT);
    await complete(card, title);
    await expect(card.locator(".task-card__headline")).toHaveText(`Another vote for ${VALUE}`);
    await expect(card.locator(".task-card__identity")).toHaveCount(0);
    await expect(announcer(page)).toHaveText(`Done. Another vote for ${VALUE}.`);
  });

  test("undo during the hold keeps the row under Anytime today", async ({ page }) => {
    const row = slimRow(remaining(page), HABIT);
    await complete(row, HABIT);
    await expect(row).toHaveAttribute("data-vote", "");

    await row.getByRole("button", { name: `Mark ${HABIT} not done` }).click();
    await expect(announcer(page)).toHaveText(`${HABIT}, not done`);
    await page.waitForTimeout(3000);
    await expect(slimRow(remaining(page), HABIT)).toHaveCount(1);
    await expect(slimRow(doneSection(page), HABIT)).toHaveCount(0);
    await expect(anytimeLabel(page)).not.toHaveAttribute("data-collapsed");
    expect(await storedStatus(page, HABIT)).toBe("todo");
  });

  test("undo from Done brings the row back and reopens the label", async ({ page }) => {
    await complete(slimRow(remaining(page), HABIT), HABIT);
    await expectLandsInDone(page, HABIT);
    await expect(anytimeLabel(page)).toHaveAttribute("data-collapsed", "true");

    await slimRow(doneSection(page), HABIT)
      .getByRole("button", { name: `Mark ${HABIT} not done` })
      .click();
    await expect(slimRow(remaining(page), HABIT)).toHaveCount(1);
    await expect(anytimeLabel(page)).not.toHaveAttribute("data-collapsed");
    expect(await storedStatus(page, HABIT)).toBe("todo");
  });

  test("'Nothing left' waits for the anytime habits too", async ({ page }) => {
    await settleEveryCard(page);
    await page.waitForTimeout(500);
    await expect(page.getByText("Nothing left for today")).toHaveCount(0);

    await complete(slimRow(remaining(page), HABIT), HABIT);
    await expectLandsInDone(page, HABIT);
    await expect(page.getByText("Nothing left for today")).toBeVisible();
  });

  test("skip from the row's menu sends it to Done as skipped", async ({ page }) => {
    await remaining(page)
      .getByRole("button", { name: `Actions for ${HABIT}` })
      .click();
    await page.getByRole("menuitem", { name: "Skip" }).click();

    const skipped = slimRow(doneSection(page), HABIT);
    await expect(skipped).toHaveCount(1, { timeout: 2000 });
    await expect(skipped).toHaveAttribute("data-status", "skip");
    await expect(skipped).toContainText("Skipped");
    await expect(skipped).not.toHaveAttribute("data-vote");
    await expect(announcer(page)).toHaveText("Skipped");
    expect(await storedStatus(page, HABIT)).toBe("skip");
  });

  test("reduced motion still shows the vote, with fades", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const row = slimRow(remaining(page), HABIT);
    await complete(row, HABIT);

    const discAnimations = await row.locator(".task-card__disc").evaluate((disc) =>
      disc
        .getAnimations()
        .filter((a) => "animationName" in a)
        .map((a) => `${(a as CSSAnimation).animationName}:${a.effect?.getTiming().duration}`),
    );
    expect(discAnimations).toEqual(["done-fade:120"]);
    await expect(row.locator(".task-card__headline")).toHaveCSS("opacity", "1");
    await expect(row.locator(".task-card__flood")).toHaveCSS("clip-path", "none");
    await expectLandsInDone(page, HABIT);
  });
}
