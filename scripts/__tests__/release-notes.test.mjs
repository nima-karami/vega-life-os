import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDeployManifest,
  buildReleaseNotes,
  parseCommitSubject,
} from "../lib/release-notes.mjs";

describe("parseCommitSubject", () => {
  it("splits a conventional subject into type, scopes and description", () => {
    assert.deepEqual(parseCommitSubject("feat(today,tasks): anytime habits join the list"), {
      type: "feat",
      scope: "today,tasks",
      description: "anytime habits join the list",
      isBreaking: false,
    });
    assert.deepEqual(parseCommitSubject("fix: guard the empty case"), {
      type: "fix",
      scope: undefined,
      description: "guard the empty case",
      isBreaking: false,
    });
  });

  it("flags a breaking change", () => {
    assert.equal(parseCommitSubject("refactor(api)!: drop the v1 route").isBreaking, true);
  });

  it("files a git revert under revert and anything else under no type", () => {
    assert.equal(parseCommitSubject('Revert "feat: a thing"').type, "revert");
    assert.equal(parseCommitSubject("Update README").type, undefined);
    assert.equal(parseCommitSubject("Update README").description, "Update README");
  });
});

describe("buildReleaseNotes", () => {
  const commits = [
    { sha: "aaa1111", subject: "fix(calendar): keep the slot on a move" },
    { sha: "bbb2222", subject: "feat(today): slim vote rows" },
    { sha: "ccc3333", subject: "Merge branch 'lane/cards'" },
    { sha: "ddd4444", subject: "merge(finance): land the finance lane" },
    { sha: "eee5555", subject: "perf(feed): skip the second layout pass" },
    { sha: "fff6666", subject: "chore: bump actions" },
    { sha: "ggg7777", subject: "tidy things up" },
    { sha: "hhh8888", subject: "feat: release records" },
  ];

  it("groups by type in a fixed order and drops merge commits", () => {
    const notes = buildReleaseNotes({ previousTag: "v2026.10.1", commits });
    const headings = notes.match(/^### .+$/gm);
    assert.deepEqual(headings, [
      "### Features",
      "### Fixes",
      "### Performance",
      "### Chores",
      "### Other",
    ]);
    assert.doesNotMatch(notes, /lane\/cards|finance lane/);
    assert.match(notes, /^- \*\*today:\*\* slim vote rows \(bbb2222\)$/m);
    assert.match(notes, /^- release records \(hhh8888\)$/m);
    assert.match(notes, /^- tidy things up \(ggg7777\)$/m);
  });

  it("keeps commit order within a group and states the range", () => {
    const notes = buildReleaseNotes({ previousTag: "v2026.10.1", commits });
    assert.ok(notes.indexOf("slim vote rows") < notes.indexOf("release records"));
    assert.match(notes, /6 commits since `v2026\.10\.1`/);
  });

  it("describes a first release as everything up to it", () => {
    const notes = buildReleaseNotes({ previousTag: undefined, commits: commits.slice(0, 1) });
    assert.match(notes, /1 commit, the first release/);
  });

  it("says so when nothing changed", () => {
    const notes = buildReleaseNotes({ previousTag: "v2026.10.1", commits: [] });
    assert.match(notes, /No commits since `v2026\.10\.1`/);
    assert.doesNotMatch(notes, /^### /m);
  });

  it("marks breaking changes", () => {
    const notes = buildReleaseNotes({
      previousTag: "v2026.10.1",
      commits: [{ sha: "abc1234", subject: "refactor(api)!: drop the v1 route" }],
    });
    assert.match(notes, /^- \*\*api:\*\* \*\*breaking:\*\* drop the v1 route \(abc1234\)$/m);
  });

  it("appends the deploy manifest", () => {
    const notes = buildReleaseNotes({
      previousTag: undefined,
      commits: [],
      manifest: "### Deploy\n\n- Server: skipped",
    });
    assert.ok(notes.trimEnd().endsWith("### Deploy\n\n- Server: skipped"));
  });
});

describe("buildDeployManifest", () => {
  it("lists what shipped with its identity", () => {
    const manifest = buildDeployManifest({
      sha: "abc1234",
      server: { status: "shipped", revision: "vega-server-00031-xyz", image: "repo@sha256:01" },
      hosting: { status: "shipped" },
      schemaHash: "3f9e00112233",
      runUrl: "https://github.com/o/r/actions/runs/1",
    });
    assert.match(manifest, /^### Deploy$/m);
    assert.match(
      manifest,
      /^- Server: shipped, revision `vega-server-00031-xyz`, image `repo@sha256:01`$/m,
    );
    assert.match(manifest, /^- Hosting: shipped, build `abc1234`$/m);
    assert.match(manifest, /^- Schema hash: `3f9e00112233`$/m);
    assert.match(manifest, /^- Commit: `abc1234`$/m);
    assert.match(manifest, /^- Run: https:\/\/github\.com\/o\/r\/actions\/runs\/1$/m);
  });

  it("names a skipped target and leaves unknown details out", () => {
    const manifest = buildDeployManifest({
      sha: "abc1234",
      server: { status: "skipped" },
      hosting: { status: "shipped" },
    });
    assert.match(manifest, /^- Server: skipped \(unchanged since live\)$/m);
    assert.doesNotMatch(manifest, /Schema hash|Run:/);
  });
});
