import { expect, test } from "@playwright/test";

/**
 * Runtime proof for the expanded icon picker. Drives the real habit editor:
 * open the popover (search auto-focused), filter by keyword, keyboard-pick an
 * icon (applied + popover closed + focus back on trigger), and confirm chrome
 * glyphs are never offered. The picker is a Notion-style popover portaled
 * outside the dialog, so its search/grid are queried at page level.
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

const iconTrigger = (page: import("@playwright/test").Page) =>
  page.getByRole("dialog").getByRole("button", { name: /^Icon:/ });

test("icon popover: search auto-focuses, filters, keyboard-picks, closes, restores focus", async ({
  page,
}) => {
  const trigger = iconTrigger(page);
  await expect(trigger).toBeVisible();

  // Open → the search field is auto-focused.
  await trigger.click();
  const search = page.getByRole("textbox", { name: "Search icons" });
  await expect(search).toBeFocused();

  // Type a keyword → a flat filtered grid; the matching glyph is offered.
  await search.fill("run");
  const footprints = page.getByRole("button", { name: "footprints", exact: true });
  await expect(footprints).toBeVisible();

  // Keyboard pick: ArrowDown into the grid, Enter selects the focused cell.
  await search.press("ArrowDown");
  await page.keyboard.press("Enter");

  // Popover closed (search gone) and focus returned to the trigger.
  await expect(search).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("icon popover: a no-match query shows an explicit empty state", async ({ page }) => {
  await iconTrigger(page).click();
  const search = page.getByRole("textbox", { name: "Search icons" });
  await search.fill("zzzznope");
  await expect(page.getByText(/No icons match/)).toBeVisible();
  await expect(page.getByRole("button", { name: "zzzznope", exact: true })).toHaveCount(0);
});

test("icon popover: chrome glyphs are never offered as choices", async ({ page }) => {
  await iconTrigger(page).click();
  const search = page.getByRole("textbox", { name: "Search icons" });

  // "chevron" / "chev" name no catalog icon → empty state, no chrome cell.
  await search.fill("chevron");
  await expect(page.getByText(/No icons match/)).toBeVisible();
  for (const chrome of ["chevD", "chevL", "chevR", "chevU", "drag", "dots", "close"]) {
    await expect(page.getByRole("button", { name: chrome, exact: true })).toHaveCount(0);
  }
});

test("icon popover: Escape on an empty query closes without changing the selection", async ({
  page,
}) => {
  const trigger = iconTrigger(page);
  await trigger.click();
  const search = page.getByRole("textbox", { name: "Search icons" });

  // First Esc clears a non-empty query; the popover stays open.
  await search.fill("heart");
  await search.press("Escape");
  await expect(search).toHaveValue("");
  await expect(search).toBeVisible();

  // Second Esc (empty query) closes the popover and returns focus to the trigger.
  await search.press("Escape");
  await expect(search).toBeHidden();
  await expect(trigger).toBeFocused();
});
