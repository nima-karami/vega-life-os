import { compareVersionTags, parseVersionTag } from "./next-version.mjs";

const HEADER = `# Changelog

Every production release of VEGA Life OS, newest first. Versions are CalVer \`vYYYY.M.N\`, the
Nth release of that month ([ADR 0005](docs/adr/2026-10-22-0005-calendar-versioning.md)).

The GitHub Releases are the record; this file mirrors them. Regenerate it with
\`npm run changelog\` rather than editing it by hand.

## Unreleased

Whatever is on \`main\` past the newest release below.`;

const BEFORE_FIRST_RELEASE = `## Before v2026.10.1

Earlier releases were not versioned. What shipped, and when, is written up in the
run reports under [\`docs/runs/\`](docs/runs/), one folder per run.`;

function formatRelease({ tagName, publishedAt, url, body }) {
  const heading = `## [${tagName}](${url}) - ${publishedAt.slice(0, 10)}`;
  const notes = body.replace(/\r\n/g, "\n").trim();
  return notes ? `${heading}\n\n${notes}` : heading;
}

export function buildChangelog(releases) {
  const versioned = releases
    .filter((release) => parseVersionTag(release.tagName))
    .sort((left, right) => compareVersionTags(right.tagName, left.tagName));
  return `${[HEADER, ...versioned.map(formatRelease), BEFORE_FIRST_RELEASE].join("\n\n")}\n`;
}
