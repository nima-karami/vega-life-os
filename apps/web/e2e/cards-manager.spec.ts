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
