import { expect, test } from "@playwright/test";

/**
 * The boot splash never outlives a broken boot. These loads fail on purpose, so this file
 * does not use failOnPageErrors; it boots the real splash, so it uses the stock `test`.
 */

const splash = "#boot";

test("a throw on the first content render swaps the splash for the error screen", async ({
  page,
}) => {
  await page.route("**/src/app/Onboarding.tsx*", async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    const broken = source.replace(
      /export function Onboarding\(\)\s*\{/,
      '$&\n  throw new Error("e2e: the first content render throws");',
    );
    if (broken === source) throw new Error("Onboarding's declaration moved; update this probe");
    await route.fulfill({ response, body: broken });
  });
  await page.goto("/");

  const errorScreen = page.getByRole("alert").filter({ hasText: "VEGA stopped on an error" });
  await expect(errorScreen).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(splash)).toHaveCount(0);
  await expect(errorScreen.getByRole("button", { name: "Reload" })).toBeVisible();
});

test("a module that fails to load swaps the splash for the start-up error", async ({ page }) => {
  await page.route("**/src/app/RootBoot.tsx*", (route) => route.abort());
  await page.goto("/");

  const startupError = page.getByRole("alert").filter({ hasText: "VEGA couldn’t start" });
  await expect(startupError).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(splash)).toHaveCount(0);
  await expect(startupError.getByRole("button", { name: "Reload" })).toBeVisible();
});

test("a boot that never renders settles on the status line after 15s", async ({ page }) => {
  await page.clock.install();
  await page.route("**/src/main.tsx", () => {});
  await page.goto("/", { waitUntil: "commit" });
  await expect(page.locator(splash)).toBeAttached();

  await page.clock.fastForward(15_000);
  await expect(page.locator(`${splash}[data-state='stalled']`)).toBeAttached();
  await expect(page.locator(".boot-status")).toHaveCSS("opacity", "1");
  await expect(page.locator(".boot-tag")).toHaveCSS("opacity", "0");
});
