#!/usr/bin/env node
// Builds the server bundle the image runs, boots it, and requires /health to answer with this
// tree's schema hash. Firestore and Auth point at a closed local port, so it can never reach prod.
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { tsImport } from "tsx/esm/api";

const SERVER_DIR = fileURLToPath(new URL("../apps/server/", import.meta.url));
const BOOT_TIMEOUT_MS = 30_000;

function fail(reason) {
  console.error(`\nsmoke-server-bundle: FAILED — ${reason}\n`);
  process.exit(1);
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

function runBuild() {
  return new Promise((resolve) => {
    const build = spawn(process.execPath, ["scripts/build.mjs"], {
      cwd: SERVER_DIR,
      stdio: "inherit",
    });
    build.on("exit", (code) => resolve(code));
  });
}

async function waitForHealth(url, server) {
  const deadline = Date.now() + BOOT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) return { error: `server exited with ${server.exitCode}` };
    try {
      const response = await fetch(url);
      return { status: response.status, body: await response.json() };
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  return { error: `no /health answer within ${BOOT_TIMEOUT_MS} ms` };
}

const buildExit = await runBuild();
if (buildExit !== 0) fail(`the bundle build exited with ${buildExit}`);

const { SCHEMA_HASH } = await tsImport("../packages/shared/src/schema-hash.ts", import.meta.url);
const [serverPort, deadPort] = [await findFreePort(), await findFreePort()];
const startedAt = performance.now();
const server = spawn(process.execPath, ["dist/index.js"], {
  cwd: SERVER_DIR,
  stdio: ["ignore", "inherit", "inherit"],
  env: {
    ...process.env,
    NODE_ENV: "test",
    PORT: String(serverPort),
    FIRESTORE_DB: "test",
    PROJECT_ID: "demo-vega-smoke",
    FIRESTORE_EMULATOR_HOST: `127.0.0.1:${deadPort}`,
    FIREBASE_AUTH_EMULATOR_HOST: `127.0.0.1:${deadPort}`,
    GIT_SHA: "smoke",
    APP_VERSION: "smoke",
  },
});

const health = await waitForHealth(`http://127.0.0.1:${serverPort}/health`, server);
const bootMs = Math.round(performance.now() - startedAt);
server.kill();

if (health.error) fail(health.error);
if (health.status !== 200) fail(`/health answered ${health.status}`);
const { ok, version, sha, schemaHash } = health.body;
if (ok !== true || version !== "smoke" || sha !== "smoke") {
  fail(`/health reported ${JSON.stringify(health.body)}`);
}
if (schemaHash !== SCHEMA_HASH) fail(`schemaHash ${schemaHash}, expected ${SCHEMA_HASH}`);
console.log(
  `smoke-server-bundle: OK — dist/index.js served /health in ${bootMs} ms (${schemaHash})`,
);
