import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDeployManifest,
  buildReleaseNotes,
  parseCommitSubject,
  parseDeployManifest,
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

  it("points a first release at the run reports instead of the whole log", () => {
    const notes = buildReleaseNotes({
      previousTag: undefined,
      commits,
      manifest: "### Deploy\n\n- Server: shipped",
    });
    assert.equal(
      notes,
      "First versioned release. Earlier history: the git log.\n\n### Deploy\n\n- Server: shipped\n",
    );
  });

  it("keeps @ mentions in subjects from pinging anyone", () => {
    const notes = buildReleaseNotes({
      previousTag: "v2026.10.1",
      commits: [
        { sha: "abc1234", subject: "build(deps): bump @vega/shared, thanks @octocat" },
        { sha: "abc1235", subject: "fix: keep `@already` and mail a@b.com as they are" },
      ],
    });
    assert.match(notes, /bump `@vega\/shared`, thanks `@octocat` \(abc1234\)/);
    assert.match(notes, /keep `@already` and mail a@b\.com as they are \(abc1235\)/);
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
      previousTag: "v2026.10.1",
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

  it("gives a skipped target the plan's reason and leaves unknown details out", () => {
    const manifest = buildDeployManifest({
      sha: "abc1234",
      server: { status: "skipped", reason: "none of 3 files changed since 56f69c3 affect it" },
      hosting: { status: "shipped" },
    });
    assert.match(
      manifest,
      /^- Server: skipped \(none of 3 files changed since 56f69c3 affect it\)$/m,
    );
    assert.doesNotMatch(manifest, /Schema hash|Run:/);
  });

  it("says plain skipped when no reason is known", () => {
    const manifest = buildDeployManifest({
      sha: "abc1234",
      server: { status: "shipped" },
      hosting: { status: "skipped", reason: "" },
    });
    assert.match(manifest, /^- Hosting: skipped$/m);
  });

  it("a shipped hosting line carries its version id", () => {
    const manifest = buildDeployManifest({
      sha: "abc1234",
      server: { status: "skipped" },
      hosting: { status: "shipped", hostingVersion: "v9f" },
    });
    assert.match(manifest, /^- Hosting: shipped, build `abc1234`, version `v9f`$/m);
  });

  it("a break-glass release says so first", () => {
    const manifest = buildDeployManifest({
      sha: "abc1234",
      server: { status: "shipped" },
      hosting: { status: "skipped" },
      isBreakGlass: true,
    });
    const [firstLine] = manifest.split("\n").filter((line) => line.startsWith("- "));
    assert.equal(firstLine, "- Path: **break-glass** (laptop release; Semgrep did not run)");
  });

  it("a normal release carries no path line", () => {
    const manifest = buildDeployManifest({
      sha: "abc1234",
      server: { status: "shipped" },
      hosting: { status: "shipped" },
    });
    assert.doesNotMatch(manifest, /Path:/);
  });
});

describe("parseDeployManifest", () => {
  const SERVER_STATES = [
    { status: "shipped", revision: "vega-server-00040-abc", image: "repo@sha256:02" },
    { status: "shipped" },
    { status: "skipped", reason: "none of 2 files changed since 56f69c3 affect it" },
  ];
  const HOSTING_STATES = [
    { status: "shipped", hostingVersion: "5f3a9c0e1d2b" },
    { status: "shipped" },
    { status: "skipped", reason: "HEAD is already live (56f69c3)" },
  ];

  function expectedParse(server, hosting) {
    return {
      server: { isShipped: server.status === "shipped", revision: server.revision },
      hosting: { isShipped: hosting.status === "shipped", hostingVersion: hosting.hostingVersion },
    };
  }

  it("parse round-trips build", () => {
    const combinations = SERVER_STATES.flatMap((server) =>
      HOSTING_STATES.flatMap((hosting) =>
        [false, true].map((isBreakGlass) => ({ server, hosting, isBreakGlass })),
      ),
    );
    for (const { server, hosting, isBreakGlass } of combinations) {
      const notes = buildReleaseNotes({
        previousTag: "v2026.10.1",
        commits: [
          { sha: "abc1234", subject: "fix: name revision `not-this-one` and version `nor-this`" },
        ],
        manifest: buildDeployManifest({ sha: "abc1234", server, hosting, isBreakGlass }),
      });
      const label = JSON.stringify({ server, hosting, isBreakGlass });
      assert.deepEqual(parseDeployManifest(notes), expectedParse(server, hosting), label);
    }
  });

  it("reads only a real Deploy heading, and the last one", () => {
    const notes = [
      "### Deployment notes\n\n- Server: shipped, revision `not-a-manifest`",
      "### Deploy\n\n- Server: shipped, revision `older`\n- Hosting: skipped",
      "### Deploy\n\n- Server: skipped\n- Hosting: shipped, build `abc1234`, version `h9`",
    ].join("\n\n");
    assert.deepEqual(parseDeployManifest(notes), {
      server: { isShipped: false, revision: undefined },
      hosting: { isShipped: true, hostingVersion: "h9" },
    });
    assert.deepEqual(parseDeployManifest(notes.replace(/\n/g, "\r\n")), parseDeployManifest(notes));
    assert.deepEqual(parseDeployManifest(notes.split("\n\n### Deploy\n")[0]), {
      server: { isShipped: false, revision: undefined },
      hosting: { isShipped: false, hostingVersion: undefined },
    });
  });

  it("notes without a Deploy section parse as nothing shipped", () => {
    assert.deepEqual(parseDeployManifest("3 commits since `v2026.10.4`.\n\n### Fixes\n"), {
      server: { isShipped: false, revision: undefined },
      hosting: { isShipped: false, hostingVersion: undefined },
    });
  });
});
