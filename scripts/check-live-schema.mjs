#!/usr/bin/env node
// The server strips unknown keys, so hosting must never ship a schema the live server lacks.
import { tsImport } from "tsx/esm/api";
import { fetchServerHealth, resolveApiUrl } from "./lib/live-endpoints.mjs";

function fail(reason) {
  console.error(`\ncheck-live-schema: FAILED — ${reason}\n`);
  process.exit(1);
}

async function fetchLiveHealth(url) {
  try {
    return await fetchServerHealth(url);
  } catch (error) {
    return fail(`GET /health failed (${error.message})`);
  }
}

const api = resolveApiUrl();
if (!api) fail("no server URL. Set VEGA_API_URL (e.g. the Cloud Run URL of vega-server).");
const { SCHEMA_HASH } = await tsImport("../packages/shared/src/schema-hash.ts", import.meta.url);
const health = await fetchLiveHealth(api.url);

console.log(`check-live-schema: server ${api.isPrintable ? api.url : `from ${api.source}`}`);
console.log(`  live version:      ${health.version ?? "(not reported)"}`);
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
