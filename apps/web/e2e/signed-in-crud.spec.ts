import { expect } from "@playwright/test";
import { test } from "./fixtures";
import { gratitudePage } from "./helpers/app";

/**
 * Full-stack signed-in CRUD proof (online-first).
 *
 * Requires the manual backend harness (not part of the default `npm run e2e`,
 * which is a signed-out sandbox suite with no server):
 *   1. Firestore + Auth emulators running (JAVA_HOME=JDK 21).
 *   2. apps/server booted with FIRESTORE_EMULATOR_HOST + FIREBASE_AUTH_EMULATOR_HOST.
 *   3. apps/web served with VITE_USE_EMULATORS=1 and VITE_API_URL=<server url>.
 *   4. A user seeded in the Auth emulator (email/password).
 * Run with: VEGA_FULLSTACK_E2E=1 npm run e2e --workspace @vega/web
 *
 * Proves: a task created while signed in persists through the backend (apps/server →
 * Firestore emulator) and survives a full page reload — the client never touches
 * Firestore directly (writes are rejected by rules; see server security-rules.test.ts).
 */
const FULLSTACK = process.env.VEGA_FULLSTACK_E2E === "1";

test.describe("signed-in CRUD persists via the backend", () => {
  test.skip(
    !FULLSTACK,
    "requires the full backend stack (apps/server + emulators) — see file header",
  );

  test("a created task survives a reload", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    // sign in via the Auth-emulator-backed sign-in gate, then create a task
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.getByRole("textbox", { name: /email/i }).fill("e2e@vega.test");
    await page.getByRole("textbox", { name: /password/i }).fill("password123");
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await gratitudePage(page).getByRole("button", { name: "Continue" }).click();

    await page
      .getByRole("button", { name: /new task|add task/i })
      .first()
      .click();
    await page.getByRole("textbox").first().fill("Backend-persisted task");
    await page.keyboard.press("Enter");
    await expect(page.getByText("Backend-persisted task")).toBeVisible();

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText("Backend-persisted task")).toBeVisible({ timeout: 15_000 });
  });
});
