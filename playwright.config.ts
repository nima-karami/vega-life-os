import { defineConfig, devices } from "@playwright/test";

/**
 * Thin runtime-QA layer: boot the real app and prove each spine view renders
 * (not a blank screen) with no uncaught errors. Not an exhaustive E2E suite.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:5180",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Two servers: the dev server for the app smoke suite, and a built preview for the
  // PWA proof (the service worker + injected manifest link only exist in a build).
  webServer: [
    {
      command: "npm run dev",
      url: "http://localhost:5180",
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
