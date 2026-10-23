import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildChangelog } from "../lib/changelog.mjs";

const releases = [
  {
    tagName: "v2026.10.2",
    publishedAt: "2026-10-24T09:00:00Z",
    url: "https://github.com/o/r/releases/tag/v2026.10.2",
    body: "1 commit since `v2026.10.1`.\r\n\r\n### Fixes\r\n\r\n- a fix (abc1234)\r\n",
  },
  {
    tagName: "v2026.9.10",
    publishedAt: "2026-09-30T09:00:00Z",
    url: "https://github.com/o/r/releases/tag/v2026.9.10",
    body: "### Features\n\n- old (0000001)",
  },
  {
    tagName: "v2026.10.1",
    publishedAt: "2026-10-22T23:30:00Z",
    url: "https://github.com/o/r/releases/tag/v2026.10.1",
    body: "### Features\n\n- first (0000002)\n",
  },
  { tagName: "archive/paper-wip", publishedAt: "2026-08-06T00:00:00Z", url: "", body: "nope" },
];

describe("buildChangelog", () => {
  it("lists v* releases newest first by version, with their UTC date and link", () => {
    const changelog = buildChangelog(releases);
    const headings = changelog.match(/^## .+$/gm);
    assert.deepEqual(headings, [
      "## Unreleased",
      "## [v2026.10.2](https://github.com/o/r/releases/tag/v2026.10.2) - 2026-10-24",
      "## [v2026.10.1](https://github.com/o/r/releases/tag/v2026.10.1) - 2026-10-22",
      "## [v2026.9.10](https://github.com/o/r/releases/tag/v2026.9.10) - 2026-09-30",
      "## Before v2026.10.1",
    ]);
    assert.doesNotMatch(changelog, /nope/);
  });

  it("carries each release body verbatim with normalised line endings", () => {
    const changelog = buildChangelog(releases);
    assert.match(changelog, /### Fixes\n\n- a fix \(abc1234\)\n\n## \[v2026\.10\.1\]/);
    assert.doesNotMatch(changelog, /\r/);
  });

  it("points history before the first release at the run reports", () => {
    assert.match(buildChangelog([]), /## Before v2026\.10\.1\n\n[^#]*docs\/runs\//);
  });

  it("is stable with no releases yet", () => {
    const changelog = buildChangelog([]);
    assert.deepEqual(changelog.match(/^## .+$/gm), ["## Unreleased", "## Before v2026.10.1"]);
    assert.ok(changelog.startsWith("# Changelog\n"));
    assert.ok(changelog.endsWith("\n") && !changelog.endsWith("\n\n"));
  });
});
