#!/usr/bin/env node
// The server strips unknown keys, so hosting must never ship a schema the live server lacks.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { tsImport } from "tsx/esm/api";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Vite's production precedence, highest first; envDir is the repo root.
const ENV_FILES = [".env.production.local", ".env.production", ".env.local", ".env"];

function fail(reason) {
  console.error(`\ncheck-live-schema: FAILED — ${reason}\n`);
  process.exit(1);
}

function readEnvFileKey(fileName, key) {
  const filePath = path.join(REPO_ROOT, fileName);
  if (!existsSync(filePath)) return undefined;
  const line = readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .find((candidate) => candidate.trim().startsWith(`${key}=`));
  return (
    line
      ?.slice(line.indexOf("=") + 1)
      .trim()
      .replace(/^["']|["']$/g, "") || undefined
  );
}

function resolveApiUrl() {
  for (const key of ["VEGA_API_URL", "VITE_API_URL"]) {
    if (process.env[key]) return { url: process.env[key], source: key, isPrintable: true };
  }
  for (const fileName of ENV_FILES) {
    const url = readEnvFileKey(fileName, "VITE_API_URL");
    if (url) return { url, source: `${fileName} VITE_API_URL`, isPrintable: false };
  }
  return fail("no server URL. Set VEGA_API_URL (e.g. the Cloud Run URL of vega-server).");
}

async function fetchLiveHealth(url) {
  const healthUrl = `${url.replace(/\/+$/, "")}/health`;
  try {
    const response = await fetch(healthUrl, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) return fail(`GET /health returned HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    return fail(`GET /health failed (${error.message})`);
  }
}

const api = resolveApiUrl();
const { SCHEMA_HASH } = await tsImport("../packages/shared/src/schema-hash.ts", import.meta.url);
const health = await fetchLiveHealth(api.url);

console.log(`check-live-schema: server ${api.isPrintable ? api.url : `from ${api.source}`}`);
console.log(`  live sha:          ${health.sha ?? "(not reported)"}`);
console.log(`  live schemaHash:   ${health.schemaHash ?? "(not reported)"}`);
console.log(`  local schemaHash:  ${SCHEMA_HASH}`);

if (!health.schemaHash) {
  fail(
    "the live server has no schemaHash (it predates /health reporting). Deploy the server first.",
  );
}
if (health.schemaHash !== SCHEMA_HASH) {
  fail("the live server's schema differs from this build's. Deploy the server first.");
}
console.log("check-live-schema: OK — live server matches this build's schema");
