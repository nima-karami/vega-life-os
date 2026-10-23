#!/usr/bin/env node
// Regenerates CHANGELOG.md from the GitHub Releases (the record). Needs `gh auth login`.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { buildChangelog } from "./lib/changelog.mjs";
import { REPO_ROOT } from "./lib/live-endpoints.mjs";
import { parseVersionTag } from "./lib/next-version.mjs";

function readGhJson(args) {
  return JSON.parse(
    execFileSync("gh", args, {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    }),
  );
}

const releaseTags = readGhJson([
  "release",
  "list",
  "--exclude-drafts",
  "--limit",
  "1000",
  "--json",
  "tagName",
])
  .map((release) => release.tagName)
  .filter((tagName) => parseVersionTag(tagName));

const releases = releaseTags.map((tagName) =>
  readGhJson(["release", "view", tagName, "--json", "tagName,publishedAt,url,body"]),
);

const changelogPath = path.join(REPO_ROOT, "CHANGELOG.md");
writeFileSync(changelogPath, buildChangelog(releases));
console.log(`changelog: wrote ${releases.length} release(s) to CHANGELOG.md`);
