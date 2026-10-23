#!/usr/bin/env node
// Prints a release's notes: conventional commits since the previous v* tag, then the deploy manifest.
// node scripts/release-notes.mjs --version=v2026.10.1 --sha=<short> --server=shipped|skipped --hosting=shipped|skipped
//   [--server-revision=…] [--server-image=…] [--schema-hash=…] [--run-url=…]
import { parseArgs } from "node:util";
import { REPO_ROOT } from "./lib/live-endpoints.mjs";
import { parseVersionTag } from "./lib/next-version.mjs";
import { composeReleaseNotes } from "./lib/release-record.mjs";

const TARGET_STATUSES = ["shipped", "skipped"];

const { values: options } = parseArgs({
  options: {
    version: { type: "string" },
    sha: { type: "string" },
    server: { type: "string" },
    hosting: { type: "string" },
    "server-revision": { type: "string" },
    "server-image": { type: "string" },
    "schema-hash": { type: "string" },
    "run-url": { type: "string" },
  },
});

function fail(reason) {
  console.error(`release-notes: ${reason}`);
  process.exit(2);
}

if (!parseVersionTag(options.version ?? "")) {
  fail(`--version must be vYYYY.M.N (got "${options.version}")`);
}
if (!options.sha) fail("--sha is required");
for (const target of ["server", "hosting"]) {
  if (!TARGET_STATUSES.includes(options[target])) {
    fail(`--${target} must be one of ${TARGET_STATUSES.join("|")} (got "${options[target]}")`);
  }
}

process.stdout.write(
  composeReleaseNotes({
    version: options.version,
    sha: options.sha,
    server: {
      status: options.server,
      revision: options["server-revision"],
      image: options["server-image"],
    },
    hosting: { status: options.hosting },
    schemaHash: options["schema-hash"],
    runUrl: options["run-url"],
    cwd: REPO_ROOT,
  }),
);
