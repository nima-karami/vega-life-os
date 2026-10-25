import { execFileSync } from "node:child_process";
import { compareVersionTags, parseVersionTag } from "./next-version.mjs";

function readGhJson(args, cwd) {
  return JSON.parse(
    execFileSync("gh", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    }),
  );
}

export function fetchVersionedReleases({ cwd, limit }) {
  const releaseTags = readGhJson(
    ["release", "list", "--exclude-drafts", "--limit", String(limit), "--json", "tagName"],
    cwd,
  )
    .map((release) => release.tagName)
    .filter((tagName) => parseVersionTag(tagName))
    .sort((left, right) => compareVersionTags(right, left));
  return releaseTags.map((tagName) =>
    readGhJson(["release", "view", tagName, "--json", "tagName,publishedAt,url,body"], cwd),
  );
}
