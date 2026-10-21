import { defineConfig, devices } from "@playwright/test";

// Overridable so parallel worktree lanes never share one server.
const devPort = process.env.E2E_PORT ?? "5188";
const previewPort = process.env.E2E_PREVIEW_PORT ?? "5179";

// The PWA proof needs a production build + preview server, which costs a full vite build.
// Only pay for it when the `pwa` project is asked for; the env flag carries the choice
// into the worker processes, which re-read this config without the CLI args.
const argv = process.argv;
const pwaSelected = argv.some(
  (arg, i) => arg === "--project=pwa" || (arg === "--project" && argv[i + 1] === "pwa"),
);
if (pwaSelected) process.env.E2E_PWA = "1";
const pwa = process.env.E2E_PWA === "1";

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
  forbidOnly: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    // Dedicated e2e port (NOT the dev server's 5180) so a long-running `npm run dev`
    // can stay up — the suite boots its own isolated server and never collides.
    baseURL: `http://localhost:${devPort}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: [/mobile\.spec\.ts/, /pwa\.spec\.ts/],
    },
    {
      // Mobile pass: a touch-capable phone profile. The spec drives several
      // narrow widths itself (320/360/390/430) via setViewportSize.
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
      testMatch: /mobile\.spec\.ts/,
    },
    ...(pwa
      ? [{ name: "pwa", use: { ...devices["Desktop Chrome"] }, testMatch: /pwa\.spec\.ts/ }]
      : []),
  ],
  // A dedicated dev server on 5188 (kept off the everyday 5180 so a long-running dev
  // server survives a test run), plus a built preview for the PWA proof (the service
  // worker + injected manifest link only exist in a build).
  webServer: [
    {
      command: `npm run dev -- --port ${devPort} --strictPort`,
      url: `http://localhost:${devPort}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    ...(pwa
      ? [
          {
            command: `vite build && vite preview --port ${previewPort} --strictPort`,
            url: `http://localhost:${previewPort}`,
            reuseExistingServer: !process.env.CI,
            timeout: 180_000,
          },
        ]
      : []),
  ],
});
