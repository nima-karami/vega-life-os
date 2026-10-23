import { expect, test } from "@playwright/test";
import { enterApp } from "./helpers/app";

/** On a phone a tap on a value card carries its disc into the value page, and Back returns. */
test("a tapped value card opens its page through the morph and Back lands on the card", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = document.startViewTransition?.bind(document);
    if (!original) return;
    Object.assign(window, { __morphs: 0 });
    document.startViewTransition = ((update: ViewTransitionUpdateCallback) => {
      Object.assign(window, { __morphs: (window as unknown as { __morphs: number }).__morphs + 1 });
      return original(update);
    }) as typeof document.startViewTransition;
  });
  await enterApp(page);
  await page.goto("/values");
  const card = page.locator('main a[href^="/values/"]').first();
  await card.tap();
  await expect(page).toHaveURL(/\/values\/[^/]+$/);
  await expect(page.getByRole("textbox", { name: "Value name" })).toBeVisible();
  await page.goBack();
  await expect(card).toBeVisible();
  await expect(page.locator("html")).not.toHaveAttribute("data-route-morph");
  expect(await page.evaluate(() => (window as unknown as { __morphs: number }).__morphs)).toBe(2);
});
