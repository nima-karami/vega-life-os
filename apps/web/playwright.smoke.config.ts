import { defineConfig, devices } from "@playwright/test";

function requireSmokeBaseUrl() {
  const smokeBaseUrl = process.env.SMOKE_BASE_URL;
  if (!smokeBaseUrl) {
    throw new Error("SMOKE_BASE_URL is required: the smoke runs against a deployed build");
  }
  return smokeBaseUrl;
}

// Post-deploy smoke against a deployed URL (no local server). baseURL is read lazily so tools that
// only inspect the config (knip) can load it without a deployment.
export default defineConfig({
  testDir: "./e2e",
  grep: /@smoke/,
  workers: 2,
  forbidOnly: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    get baseURL() {
      return requireSmokeBaseUrl();
    },
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
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
      testMatch: /mobile\.spec\.ts/,
    },
  ],
});
