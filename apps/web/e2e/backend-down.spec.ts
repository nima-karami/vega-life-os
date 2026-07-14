import { expect, test } from "@playwright/test";

/**
 * Full-stack online-first revert proof.
 *
 * Requires the same manual backend harness as signed-in-crud.spec.ts (see its
 * header). Run with: VEGA_FULLSTACK_E2E=1 npm run e2e --workspace @vega/web
 *
 * Proves: with the backend unreachable, an optimistic edit is reverted to its
 * prior value and a sticky "Retry" toast is raised — the write-contract rollback.
 * (The same rollback is unit-proven headless in
 * apps/web/src/core/store/__tests__/persist-rollback.test.ts.)
 */
const FULLSTACK = process.env.VEGA_FULLSTACK_E2E === "1";

test.describe("backend-down reverts the optimistic write", () => {
  test.skip(
    !FULLSTACK,
    "requires the full backend stack (apps/server + emulators) — see file header",
  );

  test("an edit reverts and a retry toast appears when the server is down", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.getByRole("textbox", { name: /email/i }).fill("e2e@vega.test");
    await page.getByRole("textbox", { name: /password/i }).fill("password123");
    await page.getByRole("button", { name: /^sign in$/i }).click();

    // Simulate the backend being unreachable by failing every tRPC request.
    await page.route("**/trpc/**", (route) => route.abort());

    await page
      .getByRole("button", { name: /new task|add task/i })
      .first()
      .click();
    const field = page.getByRole("textbox").first();
    await field.fill("Doomed edit");
    await page.keyboard.press("Enter");

    // The retry toast appears and the optimistic row is rolled back.
    await expect(page.getByRole("button", { name: /retry/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Doomed edit")).toHaveCount(0);
  });
});
