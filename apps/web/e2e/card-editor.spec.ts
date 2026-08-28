import { expect, test } from "@playwright/test";
import { openDeck } from "./helpers/deck";

// Authoring is a routed page now: /cards/new writes nothing until the type's required
// slots are satisfied, then replaces the route with the card it wrote.
test("a new card is written only once its required slots are filled", async ({ page }) => {
  await openDeck(page);
  await page.getByRole("button", { name: "New card" }).click();
  await expect(page).toHaveURL(/\/cards\/new$/);

  const save = page.getByRole("button", { name: "Save card" });
  await expect(save, "an empty draft cannot be saved").toBeDisabled();

  await page.getByRole("textbox", { name: "Title" }).fill("Second-order thinking");
  await expect(save, "a title alone is not a complete card").toBeDisabled();

  await page.getByRole("textbox", { name: "Body" }).fill("Ask: and then what?");
  await expect(save).toBeEnabled();
  await expect(page, "filling the fields writes nothing on its own").toHaveURL(/\/cards\/new$/);

  await save.click();
  await expect(page).toHaveURL(/\/cards\/[^/]+$/);
  await expect(page).not.toHaveURL(/\/cards\/new$/);
});

test("the field stack is generated from the type, and the live card shows the real face", async ({
  page,
}) => {
  await openDeck(page);
  await page.goto("/cards/new", { waitUntil: "domcontentloaded" });

  // A note declares Title and Body; vocabulary declares six slots including a mono pronunciation.
  await expect(page.getByRole("textbox", { name: "Title" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Pronunciation" })).toHaveCount(0);

  await page
    .getByRole("group", { name: "Card type" })
    .getByRole("button", { name: "Vocabulary" })
    .click();
  await expect(page.getByRole("textbox", { name: "Word" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Pronunciation" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Definition" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Add a synonym" })).toBeVisible();

  await page.getByRole("textbox", { name: "Word" }).fill("saudade");
  await expect(page.getByTestId("live-card")).toContainText("saudade");
});

test("the type picker is a single row from 640px up", async ({ page }) => {
  await openDeck(page);

  for (const width of [640, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/cards/new", { waitUntil: "domcontentloaded" });

    const buttons = page.getByRole("group", { name: "Card type" }).getByRole("button");
    await expect(buttons).toHaveCount(6);
    const tops: number[] = [];
    for (let index = 0; index < 6; index += 1) {
      const box = await buttons.nth(index).boundingBox();
      if (box === null) throw new Error(`type cell ${index} has no bounds at ${width}px`);
      tops.push(box.y);
    }
    for (const top of tops) {
      expect(Math.abs(top - tops[0]), `the picker wraps at ${width}px`).toBeLessThanOrEqual(1);
    }

    const overflow = await page.evaluate(() => {
      const el = document.documentElement;
      return el.scrollWidth - el.clientWidth;
    });
    expect(overflow, `page overflows horizontally at ${width}px`).toBeLessThanOrEqual(1);
  }
});

test("a saved card edits in place and the Review control states its consequence", async ({
  page,
}) => {
  await openDeck(page);
  // A prompt can never be learned, so pick a type that folds by default.
  const row = page.locator("[data-card-row]:visible").filter({ hasText: "Note" }).first();
  const id = await row.getAttribute("data-card-row");
  await page.goto(`/cards/${id}`, { waitUntil: "domcontentloaded" });

  const review = page.getByRole("button", { name: "Learning", exact: true });
  await expect(review).toBeVisible();
  await review.click();
  await expect(page.getByText(/box 1/)).toBeVisible();
});

test("deleting a card returns to the deck and offers an undo", async ({ page }) => {
  await openDeck(page);
  const before = await page.locator("[data-card-row]:visible").count();

  const id = await page.locator("[data-card-row]:visible").first().getAttribute("data-card-row");
  await page.goto(`/cards/${id}`, { waitUntil: "domcontentloaded" });

  await page.getByRole("button", { name: "Delete card" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();

  await expect(page).toHaveURL(/\/cards$/);
  await expect(page.locator("[data-card-row]:visible")).toHaveCount(before - 1);

  const undo = page.getByRole("status").filter({ hasText: "Card deleted" });
  await expect(undo).toBeVisible();
  await undo.getByRole("button", { name: "Undo" }).click();
  await expect(page.locator("[data-card-row]:visible")).toHaveCount(before);
});
