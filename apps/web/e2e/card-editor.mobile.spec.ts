import { expect, type Page, test } from "@playwright/test";
import { enterApp } from "./helpers/app";

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
