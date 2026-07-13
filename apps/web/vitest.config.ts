import path from "node:path";
import { defineConfig } from "vitest/config";

// Unit tests cover pure logic only (no DOM), so a node environment is enough.
// The runtime/e2e layer (Playwright) covers rendering; this covers correctness.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Pin the timezone so date/time math is deterministic across machines/CI.
    env: { TZ: "UTC" },
  },
});
