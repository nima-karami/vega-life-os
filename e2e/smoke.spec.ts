import { expect, test } from "@playwright/test";

/**
 * Every spine view must actually render real content with no uncaught errors.
 * This is the layer that catches a green build shipping a blank screen or a
 * thrown component — unit-level checks never see that.
 */
const ROUTES: { path: string; name: string }[] = [
  { path: "/", name: "cockpit" },
  { path: "/map", name: "map" },
  { path: "/calendar", name: "calendar" },
  { path: "/board", name: "board" },
  { path: "/values", name: "values-goals" },
  { path: "/habits", name: "habits" },
  { path: "/analytics", name: "analytics" },
  { path: "/library", name: "library" },
  { path: "/review", name: "review" },
  { path: "/settings", name: "settings" },
];

// Known-benign console noise we don't want to fail the smoke on.
const IGNORE = [
  /Download the React DevTools/i,
  /\[vite\]/i,
  /Firebase/i, // cloud sync is gated off without config — expected
];

// A fresh browser shows the first-run onboarding overlay. Clear it (and seed the
// demo dataset) so each test exercises a populated, booted app.
test.beforeEach(async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  const explore = page.getByRole("button", { name: /explore with sample data/i });
  const nav = page.getByRole("navigation").first();
  // The app settles into EITHER onboarding or the booted shell — wait for whichever.
  await expect(explore.or(nav)).toBeVisible({ timeout: 15_000 });
  if (await explore.isVisible()) {
    await explore.click();
  }
  await expect(nav).toBeVisible({ timeout: 15_000 });
});

for (const { path, name } of ROUTES) {
  test(`renders ${name} (${path})`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error" && !IGNORE.some((re) => re.test(m.text()))) {
        errors.push(`console.error: ${m.text()}`);
      }
    });

    await page.goto(path, { waitUntil: "networkidle" });

    // The app shell nav is always present once the SPA has booted (not a blank screen).
    await expect(page.getByRole("navigation").first()).toBeVisible({ timeout: 15_000 });

    // Real content rendered, not an empty/broken view.
    const text = (await page.locator("main").innerText()).trim();
    expect(text.length, `view "${name}" rendered too little text`).toBeGreaterThan(40);

    // Evidence for human/agent inspection.
    await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });

    expect(errors, `runtime errors on ${name}:\n${errors.join("\n")}`).toEqual([]);
  });
}
