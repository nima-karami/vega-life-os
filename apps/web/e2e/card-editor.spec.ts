import { expect, test } from "@playwright/test";
import { openDeck } from "./helpers/deck";

// Authoring is a routed page now: /cards/new writes nothing until the type's required
// slots are satisfied, then replaces the route with the card it wrote.
test("a new card is written only once its required slots are filled", async ({ page }) => {
  await openDeck(page);
  await page.getByRole("button", { name: "New card" }).click();
  await expect(page).toHaveURL(/\/cards\/new$/);

  await page.getByRole("textbox", { name: "Title" }).fill("Second-order thinking");
  await expect(page, "a title alone does not write the card").toHaveURL(/\/cards\/new$/);

  await page.getByRole("textbox", { name: "Body" }).fill("Ask: and then what?");
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
