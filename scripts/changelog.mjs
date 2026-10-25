#!/usr/bin/env node
// Regenerates CHANGELOG.md from the GitHub Releases (the record). Needs `gh auth login`.
import { writeFileSync } from "node:fs";
import path from "node:path";
import { buildChangelog } from "./lib/changelog.mjs";
import { fetchVersionedReleases } from "./lib/github-releases.mjs";
import { REPO_ROOT } from "./lib/live-endpoints.mjs";

const releases = fetchVersionedReleases({ cwd: REPO_ROOT, limit: 1000 });

const changelogPath = path.join(REPO_ROOT, "CHANGELOG.md");
writeFileSync(changelogPath, buildChangelog(releases));
console.log(`changelog: wrote ${releases.length} release(s) to CHANGELOG.md`);
