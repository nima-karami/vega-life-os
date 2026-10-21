import { expect, type Page, test } from "@playwright/test";
import { enterApp } from "./helpers/app";
import { openDeck } from "./helpers/deck";
import { readStoredRows } from "./helpers/stored-rows";

/**
 * The desktop `card-editor.spec.ts` runs only in the chromium project, so nothing there
 * reaches `TypeControl`'s compact branch. The `.mobile.spec.ts` suffix routes this file
 * into the Pixel 7 project instead.
 */

const TYPE_LABELS = ["Note", "Quote", "Excerpt", "Fact", "Prompt", "Vocabulary"];

const typeGroup = (page: Page) => page.getByRole("group", { name: "Card type" });

async function openNewCard(page: Page, width: number, height: number) {
  await enterApp(page);
  await page.setViewportSize({ width, height });
  await page.goto("/cards/new", { waitUntil: "domcontentloaded" });
  await expect(typeGroup(page)).toBeVisible({ timeout: 15_000 });
}

interface CellBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

async function measureCells(page: Page): Promise<CellBox[]> {
  const buttons = typeGroup(page).getByRole("button");
  await expect(buttons).toHaveCount(TYPE_LABELS.length);
  const boxes: CellBox[] = [];
  for (let index = 0; index < TYPE_LABELS.length; index += 1) {
    const box = await buttons.nth(index).boundingBox();
    if (box === null) throw new Error(`type cell ${index} has no bounds`);
    boxes.push(box);
  }
  return boxes;
}

function expectThreeByTwo(cells: CellBox[]) {
  for (const cell of cells) {
    expect(
      Math.abs(cell.width - cells[0].width),
      "type cells are equal widths",
    ).toBeLessThanOrEqual(1);
  }
  const topRow = cells.slice(0, 3);
  const bottomRow = cells.slice(3);
  for (const cell of topRow) expect(Math.abs(cell.y - topRow[0].y)).toBeLessThanOrEqual(1);
  for (const cell of bottomRow) expect(Math.abs(cell.y - bottomRow[0].y)).toBeLessThanOrEqual(1);
  expect(bottomRow[0].y - topRow[0].y, "the last three sit on a second row").toBeGreaterThan(1);
}

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const el = document.documentElement;
    return el.scrollWidth - el.clientWidth;
  });
}

test("the type picker is a three-column grid on a phone", async ({ page }) => {
  await openNewCard(page, 390, 844);

  const cells = await measureCells(page);
  expectThreeByTwo(cells);
  for (const cell of cells) expect(cell.height).toBeCloseTo(44, 0);

  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
});

test("the picker keeps every label whole at 320px", async ({ page }) => {
  await openNewCard(page, 320, 780);

  const buttons = typeGroup(page).getByRole("button");
  for (const label of TYPE_LABELS) {
    const clipped = await buttons
      .filter({ hasText: label })
      .first()
      .evaluate((el) => {
        return el.scrollWidth - el.clientWidth;
      });
    expect(clipped, `"${label}" is clipped at 320px`).toBeLessThanOrEqual(1);
  }

  expectThreeByTwo(await measureCells(page));
});

test("the picker marks the selected type and switches on press", async ({ page }) => {
  await openNewCard(page, 390, 844);

  const group = typeGroup(page);
  await expect(group.getByRole("button", { name: "Note" })).toHaveAttribute("aria-pressed", "true");
  for (const label of TYPE_LABELS.slice(1)) {
    await expect(group.getByRole("button", { name: label })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  }

  await group.getByRole("button", { name: "Vocabulary" }).click();
  await expect(group.getByRole("button", { name: "Vocabulary" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(group.getByRole("button", { name: "Note" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(page.getByRole("textbox", { name: "Word" })).toBeVisible();
});

test("the retired preview route is gone", async ({ page }) => {
  await openDeck(page);
  const id = await page.locator("[data-card-row]:visible").first().getAttribute("data-card-row");
  await page.goto(`/cards/${id}/preview`, { waitUntil: "domcontentloaded" });

  await expect(page.getByText("Page not found")).toBeVisible();
});

const previewStage = (page: Page) => page.getByTestId("preview-card");
const previewButton = (page: Page) => page.getByRole("button", { name: "Preview card" });

async function openSavedCard(page: Page, width: number, height: number) {
  await openDeck(page);
  const id = await page.locator("[data-card-row]:visible").first().getAttribute("data-card-row");
  await page.setViewportSize({ width, height });
  await page.goto(`/cards/${id}`, { waitUntil: "domcontentloaded" });
  await expect(typeGroup(page)).toBeVisible({ timeout: 15_000 });
}

test("the phone header offers preview and save, not a view toggle", async ({ page }) => {
  await openNewCard(page, 390, 844);

  await expect(previewButton(page)).toBeVisible();
  const save = page.getByRole("button", { name: "Save card" });
  await expect(save).toHaveCount(1);

  const saveBox = await save.boundingBox();
  const typeBox = await typeGroup(page).boundingBox();
  if (saveBox === null || typeBox === null) throw new Error("the header controls have no bounds");
  expect(saveBox.y, "Save sits above the form").toBeLessThan(typeBox.y);

  await expect(page.getByRole("group", { name: "Editor view" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Edit", exact: true })).toHaveCount(0);
});

// The row used to be h-11 with pt-12, which pushed its children 22px past its own box.
test("the header row contains its own children", async ({ page }) => {
  await openNewCard(page, 390, 844);

  const boxes = await previewButton(page).evaluate((el) => {
    const row = el.parentElement;
    if (row === null) throw new Error("the preview button has no parent row");
    const button = el.getBoundingClientRect();
    const rect = row.getBoundingClientRect();
    return {
      button: { top: button.top, bottom: button.bottom },
      row: { top: rect.top, bottom: rect.bottom },
    };
  });
  expect(boxes.row.top - 1).toBeLessThanOrEqual(boxes.button.top);
  expect(boxes.button.bottom).toBeLessThanOrEqual(boxes.row.bottom + 1);
});

for (const [width, height] of [
  [320, 780],
  [390, 844],
]) {
  test(`the preview overlay fits the viewport (${width}px)`, async ({ page }) => {
    await openNewCard(page, width, height);
    await previewButton(page).click();

    const stage = previewStage(page);
    await expect(stage).toBeVisible();
    const box = await stage.boundingBox();
    if (box === null) throw new Error("the preview stage has no bounding box");
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(height + 1);
    expect(box.width / box.height).toBeCloseTo(390 / 600, 2);

    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  });
}

test("the preview turns a two-sided card and closes back to the draft", async ({ page }) => {
  await openNewCard(page, 390, 844);
  const title = page.getByRole("textbox", { name: "Title" });
  await title.fill("Compounding");

  await previewButton(page).click();
  const front = page.getByRole("button", { name: "Card, showing the front" });
  await expect(front).toBeVisible();
  await front.click();
  await expect(page.getByRole("button", { name: "Card, showing the reveal" })).toBeVisible();

  await page.getByRole("button", { name: "Close preview" }).click();
  await expect(previewStage(page)).toHaveCount(0);
  await expect(title).toBeVisible();
  await expect(title).toHaveValue("Compounding");
  await expect(previewButton(page)).toBeFocused();
});

test("Escape closes the preview", async ({ page }) => {
  await openNewCard(page, 390, 844);
  await previewButton(page).click();
  await expect(previewStage(page)).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(previewStage(page)).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Title" })).toBeVisible();
});

test("a single-sided card offers no flip in the preview", async ({ page }) => {
  await openNewCard(page, 390, 844);
  await typeGroup(page).getByRole("button", { name: "Prompt" }).click();

  await previewButton(page).click();
  await expect(previewStage(page)).toBeVisible();
  await expect(page.getByRole("button", { name: /^Card, showing/ })).toHaveCount(0);
});

test("an unsent list row survives the preview", async ({ page }) => {
  await openNewCard(page, 390, 844);
  await typeGroup(page).getByRole("button", { name: "Vocabulary" }).click();

  const synonym = page.getByRole("textbox", { name: "Add a synonym" });
  await synonym.fill("aggregation");

  await previewButton(page).click();
  await expect(previewStage(page)).toBeVisible();
  await page.getByRole("button", { name: "Close preview" }).click();
  await expect(previewStage(page)).toHaveCount(0);

  await expect(synonym).toHaveValue("aggregation");
});

test("the phone mounts no card stage until the preview is opened", async ({ page }) => {
  await openNewCard(page, 390, 844);

  await expect(page.getByTestId("live-card")).toHaveCount(0);
  await expect(previewStage(page)).toHaveCount(0);

  await previewButton(page).click();
  await expect(previewStage(page)).toHaveCount(1);
  await expect(page.getByTestId("live-card")).toHaveCount(0);
});

test("the preview dialog keeps none of the modal's paper chrome", async ({ page }) => {
  await openNewCard(page, 390, 844);
  await previewButton(page).click();
  await expect(previewStage(page)).toBeVisible();

  const chrome = await page.getByRole("dialog", { name: "Card preview" }).evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      background: style.backgroundColor,
      padding: [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft],
      // Tailwind resolves `shadow-none` to a chain of transparent layers, never to "none".
      shadowColours: [...style.boxShadow.matchAll(/rgba?\([^)]*\)/g)].map(([colour]) => colour),
    };
  });
  expect(chrome.background).toBe("rgba(0, 0, 0, 0)");
  expect(chrome.padding).toEqual(["0px", "0px", "0px", "0px"]);
  expect(chrome.shadowColours.every((colour) => colour === "rgba(0, 0, 0, 0)")).toBe(true);
});

test("the preview refits when the viewport changes", async ({ page }) => {
  await openNewCard(page, 390, 844);
  await previewButton(page).click();
  await expect(previewStage(page)).toBeVisible();

  await page.setViewportSize({ width: 320, height: 780 });
  await expect
    .poll(async () => {
      const box = await previewStage(page).boundingBox();
      return box === null ? -1 : Math.abs(box.width - 288);
    })
    .toBeLessThanOrEqual(2);

  const box = await previewStage(page).boundingBox();
  if (box === null) throw new Error("the preview stage has no bounding box");
  expect(Math.abs(box.height - 443)).toBeLessThanOrEqual(2);
});

test("saving twice writes one card", async ({ page }) => {
  await openNewCard(page, 390, 844);
  const uniqueTitle = `Double submit ${Date.now()}`;
  await page.getByRole("textbox", { name: "Title" }).fill(uniqueTitle);
  await page.getByRole("textbox", { name: "Body" }).fill("Once, not twice.");

  // Both clicks in one browser task — `Promise.all` still round-trips between them, which
  // hands the handler a whole event loop to settle in and lets a double submit pass.
  await page.getByRole("button", { name: "Save card" }).evaluate((el: HTMLElement) => {
    el.click();
    el.click();
  });
  await expect(page).toHaveURL(/\/cards\/[^/]+$/);
  await expect
    .poll(async () => {
      const cards = await readStoredRows<{ title: string }>(page, "cards");
      return cards.filter((card) => card.title === uniqueTitle).length;
    })
    .toBe(1);

  await page.goto("/cards", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-card-row]", { hasText: uniqueTitle })).toHaveCount(1);
});

test("the phone previews a saved card", async ({ page }) => {
  await openSavedCard(page, 390, 844);

  await expect(previewButton(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "Save card" })).toHaveCount(0);

  await previewButton(page).click();
  await expect(previewStage(page)).toBeVisible();
  await page.getByRole("button", { name: "Close preview" }).click();
  await expect(previewStage(page)).toHaveCount(0);
});

test("the phone puts Delete at the end of the form and undo still works", async ({ page }) => {
  // 568 rather than 844: the form only overflows on a short phone, and an unscrollable
  // scroller cannot tell a tail control apart from a pinned one.
  await openSavedCard(page, 390, 568);

  const remove = page.getByRole("button", { name: "Delete card" });
  await expect(remove).toBeVisible();
  const reviewBox = await page.getByText("Review", { exact: true }).boundingBox();
  const before = await remove.boundingBox();
  if (reviewBox === null || before === null) throw new Error("the form controls have no bounds");
  expect(before.y, "Delete sits after the Review row").toBeGreaterThan(reviewBox.y);

  await typeGroup(page).hover();
  await page.mouse.wheel(0, 600);
  await expect.poll(async () => (await remove.boundingBox())?.y ?? before.y).not.toBe(before.y);

  await remove.click();
  const confirm = page.getByRole("dialog");
  await confirm.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page).toHaveURL(/\/cards$/);

  await expect(page.getByRole("status").filter({ hasText: "Card deleted" })).toBeVisible();
  const rows = page.locator("[data-card-row]");
  await expect(rows.first()).toBeVisible();
  const afterDelete = await rows.count();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(rows).toHaveCount(afterDelete + 1);
});
