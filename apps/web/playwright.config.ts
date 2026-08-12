import { defineConfig, devices } from "@playwright/test";

/**
 * Thin runtime-QA layer: boot the real app and prove each spine view renders
 * (not a blank screen) with no uncaught errors. Not an exhaustive E2E suite.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // Uncapped, Playwright takes a worker per core and starves the dev machine — which
  // shows up as spurious 30s timeouts, not as a slow run. CI gets the full box.
  workers: process.env.CI ? undefined : 2,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    // Dedicated e2e port (NOT the dev server's 5180) so a long-running `npm run dev`
    // can stay up — the suite boots its own isolated server and never collides.
    baseURL: "http://localhost:5188",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /mobile\.spec\.ts/,
    },
    {
      // Mobile pass: a touch-capable phone profile. The spec drives several
      // narrow widths itself (320/360/390/430) via setViewportSize.
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
      testMatch: /mobile\.spec\.ts/,
    },
  ],
  // Two servers: a dedicated dev server on 5188 (kept off the everyday 5180 so a
  // long-running dev server survives a test run), and a built preview for the PWA
  // proof (the service worker + injected manifest link only exist in a build).
  webServer: [
    {
      command: "npm run dev -- --port 5188 --strictPort",
      url: "http://localhost:5188",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "vite build && vite preview --port 5179 --strictPort",
      url: "http://localhost:5179",
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
