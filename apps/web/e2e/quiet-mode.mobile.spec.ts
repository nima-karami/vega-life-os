import { expect } from "@playwright/test";
import { test } from "./fixtures";
import { enterApp, turnQuietModeOff, upcomingMondayNoon } from "./helpers/app";

test("the phone nav drops Analytics while quiet and brings it back when off", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 });
  await enterApp(page);
  const nav = page.getByRole("navigation", { name: "Primary" });
  await expect(nav.getByRole("button", { name: "Today" })).toBeVisible({ timeout: 15_000 });
  await expect(nav.getByRole("button", { name: "Analytics" })).toHaveCount(0);

  await turnQuietModeOff(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(nav.getByRole("button", { name: "Analytics" })).toBeVisible({ timeout: 15_000 });
});

test("the Monday card stacks inside a 320px phone", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.clock.install({ time: upcomingMondayNoon() });
  await enterApp(page);
  await page.goto("/today", { waitUntil: "domcontentloaded" });
  const card = page.getByRole("region", { name: "A new week" });
  await expect(card).toContainText("A new week starts today.", { timeout: 15_000 });

  const box = await card.boundingBox();
  expect(box).not.toBeNull();
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(320);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
