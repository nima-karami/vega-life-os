import { expect, type Page, test } from "@playwright/test";
import { enterApp } from "./helpers/app";

async function open(page: Page, path: string) {
  await enterApp(page);
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });
}

async function restValue(page: Page, name: string) {
  await page.getByRole("button", { name: `${name} actions` }).click();
  await page.getByRole("menuitem", { name: "Rest this value" }).click();
}

test("resting a value groups it apart and bringing it back restores it", async ({ page }) => {
  await open(page, "/values");
  await restValue(page, "Courage");
  await expect(page.getByText("Courage is resting.").last()).toBeVisible();

  await page.getByRole("button", { name: /Show resting \(1\)/ }).click();
  await expect(page.getByText(/they just step out of the weekly check-in/)).toBeVisible();
  await page.getByRole("button", { name: "Courage actions" }).click();
  await page.getByRole("menuitem", { name: "Bring into season" }).click();
  await expect(page.getByText("Courage is in season.").last()).toBeVisible();
  await expect(page.getByRole("button", { name: /resting/i })).toHaveCount(0);
});

test("a resting value leaves the weekly check-in until it is brought back", async ({ page }) => {
  await open(page, "/values");
  await restValue(page, "Courage");
  await page.goto("/analytics", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await expect(page.getByRole("group", { name: "Presence" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Courage" })).toHaveCount(0);

  await page.goto("/values", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Show resting \(1\)/ }).click();
  await page.getByRole("button", { name: "Courage actions" }).click();
  await page.getByRole("menuitem", { name: "Bring into season" }).click();
  await page.goto("/analytics", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await expect(page.getByRole("group", { name: "Courage" })).toBeVisible();
});

test("a resting value shows its status on its page and sits under Resting in pickers", async ({
  page,
}) => {
  await open(page, "/values");
  await restValue(page, "Courage");
  await page.getByRole("link", { name: "Presence" }).first().click();
  await expect(page.getByText("In season", { exact: true })).toBeVisible();

  await page.goto("/habits", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Add habit" }).click();
  await page.getByRole("textbox", { name: "Habit name" }).fill("Stretch");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page).toHaveURL(/\/habits\/[^/]+$/);
  await page.getByRole("button", { name: /In service of/ }).click();
  const listbox = page.getByRole("listbox");
  await expect(listbox.getByRole("option", { name: "Resting" })).toBeDisabled();
  await expect(listbox.getByRole("option", { name: "Courage" })).toBeVisible();
});

test("a new habit is unmeasured and tracking can be switched on", async ({ page }) => {
  await open(page, "/habits");
  await page.getByRole("button", { name: "Add habit" }).click();
  await page.getByRole("textbox", { name: "Habit name" }).fill("Stretch");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page).toHaveURL(/\/habits\/[^/]+$/);

  const tracking = page.getByRole("switch", { name: "Track how often I keep it" });
  await expect(tracking).not.toBeChecked();
  await expect(page.getByText("Not tracked — just do it when it fits.")).toBeVisible();
  await page.getByText("Track how often I keep it").click();
  await expect(tracking).toBeChecked();
  await expect(page.getByText("Not tracked — just do it when it fits.")).toHaveCount(0);
  await page.getByText("Track how often I keep it").click();
  await expect(tracking).not.toBeChecked();

  await page.goto("/habits", { waitUntil: "domcontentloaded" });
  const stretch = page.locator("li", {
    has: page.getByRole("link", { name: "Stretch", exact: true }),
  });
  await expect(stretch).not.toContainText("of last");

  await page.goto("/today", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "Mark Stretch done" })).toBeVisible();
});

test("the seeded tracked habit shows its count and the untracked one does not", async ({
  page,
}) => {
  await open(page, "/habits");
  const tracked = page.locator("li", {
    has: page.getByRole("link", { name: "Read 1h before bed", exact: true }),
  });
  await expect(tracked).toContainText(/\d+ of last \d+/);
  const untracked = page.locator("li", {
    has: page.getByRole("link", { name: "Morning walk", exact: true }),
  });
  await expect(untracked).not.toContainText("of last");
});

test("an if-then plan shows on Today and clears when emptied", async ({ page }) => {
  await open(page, "/habits");
  await page.getByRole("link", { name: "Drink water", exact: true }).click();
  const plan = page.getByRole("textbox", { name: "If–then plan" });
  await plan.fill("When I pour coffee, I'll stretch");
  await plan.blur();

  await page.goto("/today", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("When I pour coffee, I'll stretch").first()).toBeVisible();

  await page.goBack();
  await page.getByRole("textbox", { name: "If–then plan" }).fill("");
  await page.getByRole("textbox", { name: "If–then plan" }).blur();
  await page.goto("/today", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("When I pour coffee, I'll stretch")).toHaveCount(0);
});

test("settings has no streak controls", async ({ page }) => {
  await open(page, "/settings");
  await expect(page.getByText("Streak rules")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /strict|balanced|forgiving/i })).toHaveCount(0);
});

test("the reflection rows show a plain count and no zero-day streak", async ({ page }) => {
  await open(page, "/analytics");
  await expect(page.getByText(/\d+ of \d+ days/).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("0-day streak")).toHaveCount(0);
});
