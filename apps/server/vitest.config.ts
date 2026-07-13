import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // One shared Firestore emulator backs every file; the global reconcile sweep reads all uids,
    // so files must not race each other.
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
    env: {
      NODE_ENV: "test",
      FIRESTORE_DB: "test",
      PROJECT_ID: "vega-life-os",
    },
  },
});
