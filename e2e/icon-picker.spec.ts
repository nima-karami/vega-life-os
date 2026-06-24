import { expect, test } from "@playwright/test";

/**
 * Runtime proof for the expanded icon picker. Drives the real habit editor:
 * open the panel (search auto-focused), filter by keyword, keyboard-pick an icon
 * (applied + collapsed + focus back on trigger), and confirm chrome glyphs are
 * never offered.
 */

async function passGratitudeGate(page: import("@playwright/test").Page) {
  const gate = page.getByRole("button", { name: "Continue to today" });
  if (await gate.isVisible().catch(() => false)) {
    await page.getByRole("textbox", { name: "Grateful for, item 1" }).fill("e2e gratitude");
    await gate.click();
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });

  const explore = page.getByRole("button", { name: /explore with sample data/i });
  const omni = page.getByTestId("omni-trigger");
  const main = page.locator("main");
  await expect(explore.or(omni).or(main)).toBeVisible({ timeout: 20_000 });
  if (await explore.isVisible()) {
    await explore.click();
    await expect(main).toBeVisible({ timeout: 15_000 });
  }

  await passGratitudeGate(page);
  await page.goto("/habits", { waitUntil: "networkidle" });
  await expect(main).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Add habit" }).click();
  await expect(page.getByRole("button", { name: "Create habit" })).toBeVisible();
});

test("icon panel: search auto-focuses, filters, keyboard-picks, collapses, restores focus", async ({
  page,
}) => {
  const dialog = page.getByRole("dialog");
  const trigger = dialog.getByRole("button", { name: "Icon: change" });
  await expect(trigger).toBeVisible();

  // Open → the search field is auto-focused.
  await trigger.click();
  const search = dialog.getByRole("textbox", { name: "Search icons" });
  await expect(search).toBeFocused();

  // Type a keyword → a flat filtered grid; the matching glyph is offered.
  await search.fill("run");
  const footprints = dialog.getByRole("button", { name: "footprints", exact: true });
  await expect(footprints).toBeVisible();

  // Keyboard pick: ArrowDown into the grid, Enter selects the focused cell.
  await search.press("ArrowDown");
  await page.keyboard.press("Enter");

  // Panel collapsed (search gone) and focus returned to the trigger.
  await expect(search).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("icon panel: a no-match query shows an explicit empty state", async ({ page }) => {
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Icon: change" }).click();
  const search = dialog.getByRole("textbox", { name: "Search icons" });
  await search.fill("zzzznope");
  await expect(dialog.getByText(/No icons match/)).toBeVisible();
  await expect(dialog.getByRole("button", { name: "zzzznope", exact: true })).toHaveCount(0);
});

test("icon panel: chrome glyphs are never offered as choices", async ({ page }) => {
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Icon: change" }).click();
  const search = dialog.getByRole("textbox", { name: "Search icons" });

  // "chevron" / "chev" name no catalog icon → empty state, no chrome cell.
  await search.fill("chevron");
  await expect(dialog.getByText(/No icons match/)).toBeVisible();
  for (const chrome of ["chevD", "chevL", "chevR", "chevU", "drag", "dots", "close"]) {
    await expect(dialog.getByRole("button", { name: chrome, exact: true })).toHaveCount(0);
  }
});

test("icon panel: Escape on an empty query collapses without changing the selection", async ({
  page,
}) => {
  const dialog = page.getByRole("dialog");
  const trigger = dialog.getByRole("button", { name: "Icon: change" });
  await trigger.click();
  const search = dialog.getByRole("textbox", { name: "Search icons" });

  // First Esc clears a non-empty query; the panel stays open.
  await search.fill("heart");
  await search.press("Escape");
  await expect(search).toHaveValue("");
  await expect(search).toBeVisible();

  // Second Esc (empty query) collapses and returns focus to the trigger.
  await search.press("Escape");
  await expect(search).toBeHidden();
  await expect(trigger).toBeFocused();
});
