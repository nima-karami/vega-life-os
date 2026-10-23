import { expect, type Page, test } from "@playwright/test";
import { enterApp, gratitudePage } from "./app";
import { countOf, readMotion, recordMotion } from "./motion-log";
import { readStoredRows } from "./stored-rows";

const LINES = ["Morning light", "Coffee with Robin"];

function noonToday(): number {
  const noon = new Date();
  noon.setHours(12, 0, 0, 0);
  return noon.getTime();
}

const layer = (page: Page) => page.locator(".gratitude-layer");
const pill = (page: Page) => page.getByRole("button", { name: "Edit entry" });

async function writeLines(page: Page, route: string) {
  await page.goto(route);
  const prompt = gratitudePage(page);
  await expect(prompt).toBeVisible({ timeout: 20_000 });
  for (const [i, line] of LINES.entries()) {
    await prompt.getByRole("textbox", { name: `Grateful for, item ${i + 1}` }).fill(line);
  }
}

/** Two taps on Continue, faster than the 900ms departure, at the button's own spot. */
async function doubleTapContinue(page: Page) {
  const box = await gratitudePage(page).getByRole("button", { name: "Continue" }).boundingBox();
  if (!box) throw new Error("Continue has no box");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.click(x, y);
  await page.mouse.click(x, y);
}

async function expectSettledOnToday(page: Page) {
  await expect(layer(page)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Today", level: 1, exact: true })).toBeVisible();
  await expect(pill(page)).toBeVisible();
  await expect(pill(page).locator(".journal-entry-dot")).toHaveCSS("opacity", "1");
  // Nothing may keep filling once it lands, or the pill would lose its own press feedback.
  await expect
    .poll(() => pill(page).evaluate((el) => el.getAnimations({ subtree: true }).length))
    .toBe(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect
    .poll(async () => {
      const entries = await readStoredRows<{ gratitude: string[] }>(page, "journal");
      return entries.some((entry) => LINES.every((line) => entry.gratitude.includes(line)));
    })
    .toBe(true);
}

/** Gratitude B · Carry to entry: the written lines fly into Today's "Edit entry" pill. */
export function describeGratitudeCarry() {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(noonToday());
    await recordMotion(page);
    await enterApp(page, { keepGratitudePage: true });
  });

  test("the lines carry into the pill once, then Today is left as it was", async ({ page }) => {
    await writeLines(page, "/");
    await doubleTapContinue(page);
    await expect(layer(page)).toHaveAttribute("data-departure", "kept");
    await expect(layer(page)).toHaveAttribute("data-carry", "aim");
    await expect(pill(page)).toHaveAttribute("data-gratitude-landing", "");

    await expectSettledOnToday(page);
    const { animations } = await readMotion(page);
    expect(countOf(animations, "gratitude-carry")).toBe(LINES.length);
    expect(countOf(animations, "gratitude-pop")).toBe(1);
    expect(countOf(animations, "journal-pill-pop")).toBe(1);
    expect(countOf(animations, "journal-dot-in")).toBe(1);
  });

  test("under reduced motion every beat is a fade: nothing flies, pops or moves", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await writeLines(page, "/");
    await gratitudePage(page).getByRole("button", { name: "Continue" }).click();
    await expect(layer(page)).toHaveAttribute("data-carry", "aim");

    await expectSettledOnToday(page);
    const { animations } = await readMotion(page);
    expect(animations).not.toContain("gratitude-carry");
    expect(animations).not.toContain("gratitude-pop");
    expect(animations).not.toContain("journal-pill-pop");
    expect(animations).toContain("gratitude-fade-out");
    expect(animations).toContain("journal-dot-in");
  });

  test("a route with no pill fades the lines out where they are", async ({ page }) => {
    await writeLines(page, "/settings");
    await gratitudePage(page).getByRole("button", { name: "Continue" }).click();
    await expect(layer(page)).toHaveAttribute("data-carry", "fade");

    await expect(layer(page)).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Settings", level: 1, exact: true }),
    ).toBeVisible();
    expect((await readMotion(page)).animations).not.toContain("gratitude-carry");
  });

  test("nothing written takes the quick skip fade", async ({ page }) => {
    await page.goto("/");
    await expect(gratitudePage(page)).toBeVisible({ timeout: 20_000 });
    await gratitudePage(page).getByRole("button", { name: "Continue" }).click();
    await expect(layer(page)).toHaveAttribute("data-departure", "skip");

    await expect(layer(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Journal" })).toBeVisible();
    expect((await readMotion(page)).animations).not.toContain("gratitude-carry");
  });
}
