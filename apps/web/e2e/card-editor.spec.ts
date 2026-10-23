import { expect } from "@playwright/test";
import { test } from "./fixtures";
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

  await page.getByRole("textbox", { name: "Word" }).fill("hiraeth");
  await expect(page.getByTestId("live-card")).toContainText("hiraeth");
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

test("a new card can be created already learning", async ({ page }) => {
  await openDeck(page);
  await page.getByRole("button", { name: "New card" }).click();
  await expect(page).toHaveURL(/\/cards\/new$/);

  await page.getByRole("textbox", { name: "Title" }).fill("Hiraeth");
  await page
    .getByRole("textbox", { name: "Body" })
    .fill("A longing for a home you cannot return to.");

  const learning = page.getByRole("button", { name: "Learning", exact: true });
  await expect(learning).toHaveAttribute("aria-pressed", "false");
  await learning.click();
  await expect(learning).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/Starts in review/)).toBeVisible();

  await page.getByRole("button", { name: "Save card" }).click();
  await expect(page).toHaveURL(/\/cards\/[^/]+$/);
  await expect(page).not.toHaveURL(/\/cards\/new$/);
  await expect(page.getByText(/box 1/)).toBeVisible();
});

test("a draft never claims a history it does not have", async ({ page }) => {
  await openDeck(page);
  await page.goto("/cards/new", { waitUntil: "domcontentloaded" });

  const learning = page.getByRole("button", { name: "Learning", exact: true });
  await expect(page.getByText("Not learning", { exact: true })).toBeVisible();
  await expect(page.getByText(/added/), "an unsaved draft has no add date").toHaveCount(0);

  await learning.click();
  await expect(page.getByText("Starts in review · box 1, due today")).toBeVisible();
  await expect(page.getByText(/added/), "enrolling a draft adds no history").toHaveCount(0);
});

test("an empty draft shows its type's sample content, ghosted", async ({ page }) => {
  await openDeck(page);
  await page.goto("/cards/new", { waitUntil: "domcontentloaded" });

  const live = page.getByTestId("live-card");
  await expect(live).toContainText("Second-order thinking");
  expect(await live.locator('[data-sample="true"]').count()).toBeGreaterThan(0);

  await page
    .getByRole("group", { name: "Card type" })
    .getByRole("button", { name: "Vocabulary" })
    .click();
  await expect(live).toContainText("saudade");
});

test("typing a slot replaces its sample at full strength", async ({ page }) => {
  await openDeck(page);
  await page.goto("/cards/new", { waitUntil: "domcontentloaded" });

  await page.getByRole("textbox", { name: "Title" }).fill("Compounding");

  const live = page.getByTestId("live-card");
  await expect(live).toContainText("Compounding");
  await expect(live).not.toContainText("Second-order thinking");
  await expect(live.locator('[data-sample="true"]', { hasText: "Compounding" })).toHaveCount(0);
});

// The preview control is gated on useBelowLarge, not on a CSS class — regressing that to
// `lg:hidden` would dual-mount two card stages below lg and still look right.
test("the editor shows no preview button at lg and above", async ({ page }) => {
  await openDeck(page);
  await page.goto("/cards/new", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("button", { name: "Preview card" })).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Editor view" })).toHaveCount(0);
  await expect(page.getByTestId("live-card")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save card" })).toHaveCount(1);
});

// 640-1023 is one column with no aside, so it needs the preview button. A gate wired
// to useCompact() passes phone and desktop and fails only here.
for (const [width, height] of [
  [800, 1000],
  [700, 1000],
]) {
  test(`the tablet band gets the preview button instead of the aside (${width}px)`, async ({
    page,
  }) => {
    await openDeck(page);
    await page.setViewportSize({ width, height });
    await page.goto("/cards/new", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("button", { name: "Preview card" })).toBeVisible();
    await expect(page.getByTestId("live-card")).toHaveCount(0);

    await page.getByRole("button", { name: "Preview card" }).click();
    const stage = page.getByTestId("preview-card");
    await expect(stage).toBeVisible();
    const box = await stage.boundingBox();
    if (box === null) throw new Error("the preview stage has no bounding box");
    expect(box.width).toBeCloseTo(390, 0);
    expect(box.height).toBeCloseTo(600, 0);

    await page.getByRole("button", { name: "Close preview" }).click();
    await expect(stage).toHaveCount(0);
  });
}

test("an Excerpt draft's live card turns from the title to the passage", async ({ page }) => {
  await openDeck(page);
  await page.goto("/cards/new", { waitUntil: "domcontentloaded" });
  await page
    .getByRole("group", { name: "Card type" })
    .getByRole("button", { name: "Excerpt" })
    .click();

  await page.getByRole("textbox", { name: "Title" }).fill("On attending");
  await page
    .getByRole("textbox", { name: "Excerpt" })
    .fill("Attention costs the giver everything.");

  // Both faces stay mounted so the card can turn; the withheld one is the aria-hidden side.
  const live = page.getByTestId("live-card");
  const hidden = live.locator('[aria-hidden="true"]');
  await expect(live.getByRole("button", { name: "Card, showing the front" })).toBeVisible();
  await expect(hidden).toContainText("Attention costs the giver everything.");
  await expect(hidden).not.toContainText("On attending");

  await live.getByRole("button", { name: "Card, showing the front" }).click();
  await expect(live.getByRole("button", { name: "Card, showing the reveal" })).toBeVisible();
  await expect(hidden).toContainText("On attending");
  await expect(hidden).not.toContainText("Attention costs the giver everything.");
});
