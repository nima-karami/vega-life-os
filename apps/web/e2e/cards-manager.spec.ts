import { expect, type Locator, type Page, test } from "@playwright/test";
import { openDeck } from "./helpers/deck";

// Both the table and the mobile list are mounted; only one is visible at a given width.
const rows = (page: Page) => page.locator("[data-card-row]:visible");

// React Aria keeps the real checkbox visually hidden behind its styled control, so the hit-target
// is the label, not the input — the same force-click the finance specs use.
const check = (target: Locator) => target.click({ force: true });

test("the manager lives at /cards and the old path redirects", async ({ page }) => {
  await openDeck(page);
  await expect(page.getByRole("checkbox", { name: "Select every card in view" })).toBeVisible();

  await page.goto("/scroll/manage", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/cards$/);
  await expect(page.getByRole("heading", { name: "Cards", level: 1 })).toBeVisible();
});

test("the filter readouts agree with each other and with the rows", async ({ page }) => {
  await openDeck(page);
  const total = await rows(page).count();

  await page.getByRole("button", { name: "Filter cards" }).click();
  await check(page.getByRole("checkbox", { name: "Vocabulary" }));
  await check(page.getByRole("checkbox", { name: "Learning", exact: true }));

  const visible = await rows(page).count();
  expect(visible).toBeLessThan(total);

  // The badge counts checked values (2); the footer and the stats line count rows.
  await expect(page.getByRole("button", { name: "Filter cards" })).toContainText("2");
  await expect(page.getByText(`${visible} of ${total} cards`, { exact: true })).toBeVisible();
  await expect(
    page.getByText(`${visible} of ${total} cards · filtered`, { exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(rows(page)).toHaveCount(total);
});

test("a category cell creates the category that was typed", async ({ page }) => {
  await openDeck(page);
  const chip = rows(page)
    .first()
    .getByRole("button", { name: /^Category of / });
  await chip.click();

  await page.getByRole("textbox", { name: "Filter categories" }).fill("Deep work");
  await page.getByRole("button", { name: "Create “Deep work”" }).click();

  await expect(chip).toContainText("Deep work");
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(rows(page).filter({ hasText: "Deep work" }).first()).toBeVisible();
});

test("every picker row stays inside its popover, and a long category ellipsizes", async ({
  page,
}) => {
  await openDeck(page);
  const row = rows(page).first();

  await row.getByRole("button", { name: /^Type of / }).click();
  const surface = page.locator(".popover").first();
  await expect(surface.getByRole("option").first()).toBeVisible();
  // The popover zooms in, so read every box in one frame or the scale skews the comparison.
  await expect(surface).not.toHaveAttribute("data-entering", "true");
  const spill = await surface.evaluate((node) => {
    const box = node.getBoundingClientRect();
    return [...node.querySelectorAll('[role="option"]')].map((option) => {
      const optionBox = option.getBoundingClientRect();
      const indicator = option.querySelector(".list-box-item__indicator");
      const indicatorRight =
        indicator === null ? optionBox.right : indicator.getBoundingClientRect().right;
      return {
        left: optionBox.left - box.left,
        right: box.right - optionBox.right,
        indicator: box.right - indicatorRight,
      };
    });
  });
  expect(spill.length).toBeGreaterThan(1);
  for (const edges of spill) {
    expect(edges.left).toBeGreaterThanOrEqual(-1);
    expect(edges.right).toBeGreaterThanOrEqual(-1);
    expect(edges.indicator).toBeGreaterThanOrEqual(-1);
  }
  await page.keyboard.press("Escape");

  const longName = "Deliberate practice and spaced repetition";
  const chip = row.getByRole("button", { name: /^Category of / });
  await chip.click();
  await page.getByRole("textbox", { name: "Filter categories" }).fill(longName);
  await page.getByRole("button", { name: `Create “${longName}”` }).click();
  await expect(chip).toContainText("Deliberate");

  await chip.click();
  const label = page.locator(".popover").first().getByText(longName, { exact: true });
  await expect(label).toBeVisible();
  const overflow = await label.evaluate((node) => ({
    scrollWidth: node.scrollWidth,
    clientWidth: node.clientWidth,
    textOverflow: getComputedStyle(node).textOverflow,
  }));
  expect(overflow.textOverflow).toBe("ellipsis");
  expect(overflow.scrollWidth).toBeGreaterThan(overflow.clientWidth);
});

test("the inline Type chip confirms before it ends a review schedule", async ({ page }) => {
  await openDeck(page);

  // Narrow to notes so the first row folds by default and can be put in review.
  await page.getByRole("button", { name: "Filter cards" }).click();
  await check(page.getByRole("checkbox", { name: "Note", exact: true }));
  await page.keyboard.press("Escape");

  const row = rows(page).first();
  await row.getByRole("button", { name: /^Learning of / }).click();
  await page.getByRole("option", { name: "Learning", exact: true }).click();
  await expect(row.getByRole("button", { name: /^Learning of / })).toContainText("box 1");

  await row.getByRole("button", { name: /^Type of / }).click();
  await page.getByRole("option", { name: "Prompt" }).click();

  // The chip popover is a dialog too, so the confirm is named.
  const confirm = page.getByRole("dialog", { name: "Change type?" });
  await expect(confirm).toContainText(
    "This card is in review. Changing to Prompt ends its schedule.",
  );
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await expect(row.getByRole("button", { name: /^Type of / })).toContainText("Note");

  await row.getByRole("button", { name: /^Type of / }).click();
  await page.getByRole("option", { name: "Prompt" }).click();
  await page
    .getByRole("dialog", { name: "Change type?" })
    .getByRole("button", { name: "Change type" })
    .click();
  await expect(row.getByRole("button", { name: /^Learning of / })).toContainText("Not learning");
});

test("bulk learning skips what has nothing to recall and says how many", async ({ page }) => {
  await openDeck(page);

  await page.getByRole("button", { name: "Filter cards" }).click();
  await check(page.getByRole("checkbox", { name: "Prompt", exact: true }));
  await page.keyboard.press("Escape");
  test.skip((await rows(page).count()) === 0, "the sample deck holds no prompt cards");

  await check(page.getByRole("checkbox", { name: "Select every card in view" }));
  await page.getByRole("button", { name: "Set learning for selection" }).click();
  await page.getByRole("option", { name: "Learning", exact: true }).click();

  await expect(page.getByRole("status").filter({ hasText: /skipped/ })).toBeVisible();
  await expect(rows(page).filter({ hasText: "box 1" })).toHaveCount(0);
});

test("selection survives a filter and the view toggle", async ({ page }) => {
  await openDeck(page);
  await rows(page).nth(0).getByRole("checkbox").click({ force: true });
  await rows(page).nth(1).getByRole("checkbox").click({ force: true });
  await expect(page.getByText("2 selected")).toBeVisible();

  await page.getByRole("searchbox", { name: "Search cards" }).fill("zzzz-no-such-card");
  await expect(page.getByText("2 selected")).toBeVisible();

  await page.getByRole("searchbox", { name: "Search cards" }).fill("");
  await page.getByRole("button", { name: "Gallery view" }).click();
  await expect(page.getByText("2 selected")).toBeVisible();

  await page.getByRole("button", { name: "Table view" }).click();
  await expect(page.getByText("2 selected")).toBeVisible();
});

test("a bulk delete needs the word delete, then offers an undo", async ({ page }) => {
  await openDeck(page);
  const before = await rows(page).count();

  await rows(page).nth(0).getByRole("checkbox").click({ force: true });
  await rows(page).nth(1).getByRole("checkbox").click({ force: true });
  await page.getByRole("button", { name: "Delete", exact: true }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Delete 2 cards?");
  const confirm = dialog.getByRole("button", { name: "Delete", exact: true });
  await expect(confirm).toBeDisabled();

  await dialog.getByRole("textbox", { name: "Type delete to confirm" }).fill("del");
  await expect(confirm).toBeDisabled();
  await dialog.getByRole("textbox", { name: "Type delete to confirm" }).fill("delete");
  await confirm.click();

  await expect(rows(page)).toHaveCount(before - 2);
  const undo = page.getByRole("status").filter({ hasText: "2 cards deleted" });
  await expect(undo).toBeVisible();

  await undo.getByRole("button", { name: "Undo" }).click();
  await expect(rows(page)).toHaveCount(before);
});

test("an empty search and an empty deck read differently", async ({ page }) => {
  await openDeck(page);
  await page.getByRole("searchbox", { name: "Search cards" }).fill("zzzz-no-such-card");
  await expect(page.getByText("Nothing matches those filters")).toBeVisible();
  await expect(page.getByText("Write your first card")).toHaveCount(0);

  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(rows(page).first()).toBeVisible();
});

test("the gallery shows real faces and a tile turns", async ({ page }) => {
  await openDeck(page);
  await page.getByRole("button", { name: "Gallery view" }).click();

  const tile = page.getByRole("button", { name: /— face$/ }).first();
  await expect(tile).toBeVisible();
  const label = (await tile.getAttribute("aria-label")) ?? "";
  await tile.click();
  await expect(
    page.getByRole("button", { name: label.replace("— face", "— reveal") }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/cards$/);
});

test("a table row's context menu lists the five actions in order and Select/Deselect toggles just that row", async ({
  page,
}) => {
  await openDeck(page);
  const row = rows(page).first();

  await row.click({ button: "right" });
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  const items = menu.getByRole("menuitem");
  await expect(items).toHaveCount(5);
  await expect(items.nth(0)).toHaveText("Open");
  await expect(items.nth(1)).toHaveText("Select");
  await expect(items.nth(2)).toHaveText(/^(Start|Stop) learning$/);
  await expect(items.nth(3)).toHaveText(/^(Hide|Restore)$/);
  await expect(items.nth(4)).toHaveText("Delete");

  await items.nth(1).click();
  await expect(menu).toBeHidden();
  await expect(page.getByText("1 selected")).toBeVisible();
  await expect(row.getByRole("checkbox")).toBeChecked();

  const secondRow = rows(page).nth(1);
  await expect(secondRow.getByRole("checkbox")).not.toBeChecked();

  await row.click({ button: "right" });
  await expect(menu.getByRole("menuitem", { name: "Deselect" })).toBeVisible();
  await menu.getByRole("menuitem", { name: "Deselect" }).click();
  await expect(page.getByText("1 selected")).toHaveCount(0);
  await expect(row.getByRole("checkbox")).not.toBeChecked();
});

test("Open, and Hide/Restore, from a row's context menu behave exactly like their inline controls", async ({
  page,
}) => {
  await openDeck(page);
  const row = rows(page).first();
  const title = (await row.getByRole("button").first().innerText()).trim();

  await row.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Hide" }).click();
  await expect(row.getByRole("button", { name: `Restore ${title}` })).toBeVisible();

  await row.click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: "Restore" })).toBeVisible();
  await page.getByRole("menuitem", { name: "Restore" }).click();
  await expect(row.getByRole("button", { name: `Hide ${title}` })).toBeVisible();

  await row.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Open" }).click();
  await expect(page).toHaveURL(/\/cards\/[^/]+$/);
});

test("a row's context menu never opens the native menu or flips selection by itself, and empty space still gets it", async ({
  page,
}) => {
  await openDeck(page);
  const row = rows(page).first();

  await row.click({ button: "right" });
  await expect(page.getByRole("menu")).toBeVisible();
  await expect(row.getByRole("checkbox")).not.toBeChecked();
  // Only a touch-opened menu absorbs its dismissing tap; a mouse one leaves the page uncovered.
  await expect(page.locator("[data-menu-scrim]")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toBeHidden();

  await page.mouse.click(6, 6, { button: "right" });
  await expect(page.getByRole("menu")).toHaveCount(0);
});

test("a menu delete needs a confirm naming the card, offers undo, and Cancel is a no-op", async ({
  page,
}) => {
  await openDeck(page);
  const before = await rows(page).count();
  const row = rows(page).first();
  const title = (await row.getByRole("button").first().innerText()).trim();

  await row.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Delete" }).click();
  const dialog = page.getByRole("dialog", { name: "Delete card?" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(title);

  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  await expect(rows(page)).toHaveCount(before);
  await expect(rows(page).filter({ hasText: title })).toHaveCount(1);

  await row.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page
    .getByRole("dialog", { name: "Delete card?" })
    .getByRole("button", { name: "Delete" })
    .click();

  await expect(rows(page)).toHaveCount(before - 1);
  const undo = page.getByRole("status").filter({ hasText: "1 card deleted" });
  await expect(undo).toBeVisible();

  await undo.getByRole("button", { name: "Undo" }).click();
  await expect(rows(page)).toHaveCount(before);
});

test("a confirmed menu delete drops the card from an existing multi-selection", async ({
  page,
}) => {
  await openDeck(page);
  await rows(page).nth(0).getByRole("checkbox").click({ force: true });
  const target = rows(page).nth(1);
  await target.getByRole("checkbox").click({ force: true });
  await expect(page.getByText("2 selected")).toBeVisible();

  await target.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page
    .getByRole("dialog", { name: "Delete card?" })
    .getByRole("button", { name: "Delete" })
    .click();

  await expect(page.getByText("1 selected")).toBeVisible();
});

test("a gallery tile's context menu opens without flipping the card, on both a flippable and a plain tile", async ({
  page,
}) => {
  await openDeck(page);
  await page.getByRole("button", { name: "Gallery view" }).click();

  const flippable = page.getByRole("button", { name: /— face$/ }).first();
  await expect(flippable).toBeVisible();
  const faceLabel = (await flippable.getAttribute("aria-label")) ?? "";

  await flippable.click({ button: "right" });
  const menu = page.getByRole("menu");
  await expect(menu.getByRole("menuitem")).toHaveCount(5);
  // Still showing its face — the right-click did not flip it.
  await expect(page.getByRole("button", { name: faceLabel })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();

  const plain = page.getByRole("figure", { name: /— face$/ }).first();
  await expect(plain).toBeVisible();
  await plain.click({ button: "right" });
  await expect(menu.getByRole("menuitem")).toHaveCount(5);
});

test("an excerpt tile shows its title and turns to the passage and its source", async ({
  page,
}) => {
  await openDeck(page);
  await page.getByRole("button", { name: "Gallery view" }).click();

  // Before excerpts folded this tile was a figure with no back at all, so the role is the assertion.
  const tile = page.getByRole("button", { name: "The cost of a switch — face" });
  await expect(tile).toBeVisible();
  await expect(tile.locator('[aria-hidden="true"]')).toContainText("Deep Work · p. 41");

  await tile.click();
  const turned = page.getByRole("button", { name: "The cost of a switch — reveal" });
  await expect(turned).toBeVisible();
  await expect(turned.locator('[aria-hidden="true"]')).toContainText("The cost of a switch");
  await expect(turned.locator('[aria-hidden="true"]')).not.toContainText("Deep Work");
});
