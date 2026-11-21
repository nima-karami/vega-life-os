import { expect } from "@playwright/test";
import { test } from "./fixtures";
import { enterApp } from "./helpers/app";

test("signed out, agent access asks you to sign in and offers no token", async ({ page }) => {
  await enterApp(page);
  await page.goto("/settings", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Agent access (MCP)" })).toBeVisible();
  await expect(page.getByText("Sign in to connect agents to your VEGA account.")).toBeVisible();
  await expect(page.getByRole("button", { name: "New token" })).toHaveCount(0);
});
