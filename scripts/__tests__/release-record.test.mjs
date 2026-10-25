import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import {
  composeReleaseNotes,
  ensureReleaseTag,
  findPreviousVersionTag,
  listCommitsSince,
  listVersionTags,
  listVersionTagsAt,
} from "../lib/release-record.mjs";

let repoDir;
const shas = {};

function runGit(args) {
  return execFileSync(
    "git",
    ["-c", "user.name=test", "-c", "user.email=test@example.com", ...args],
    { cwd: repoDir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  ).trim();
}

function commit(name, subject) {
  writeFileSync(path.join(repoDir, `${name}.txt`), `${name}\n`);
  runGit(["add", "."]);
  runGit(["commit", "--quiet", "--no-verify", "-m", subject]);
  shas[name] = runGit(["rev-parse", "--short", "HEAD"]);
}

before(() => {
  repoDir = mkdtempSync(path.join(tmpdir(), "vega-release-record-"));
  runGit(["init", "--quiet", "--initial-branch=main"]);
  // ensureReleaseTag runs git itself; CI runners have no global identity.
  runGit(["config", "user.name", "test"]);
  runGit(["config", "user.email", "test@example.com"]);
  commit("root", "chore: root");
  commit("first", "feat: first feature");
  runGit(["tag", "-a", "v2026.9.1", "-m", "v2026.9.1"]);
  runGit(["tag", "archive/paper-wip"]);
  commit("second", "fix: second fix");
  runGit(["tag", "-a", "v2026.10.1", "-m", "v2026.10.1"]);
  runGit(["checkout", "--quiet", "-b", "side"]);
  commit("side", "feat: side work");
  runGit(["tag", "-a", "v2026.10.9", "-m", "v2026.10.9"]);
  runGit(["checkout", "--quiet", "main"]);
  commit("third", "feat: third feature");
  runGit(["merge", "--quiet", "--no-ff", "-m", "Merge branch 'side'", "side"]);
  shas.merge = runGit(["rev-parse", "--short", "HEAD"]);
  commit("fourth", "perf: fourth");
});

after(() => rmSync(repoDir, { recursive: true, force: true }));

describe("listVersionTags", () => {
  it("lists every v* tag and nothing else", () => {
    assert.deepEqual(listVersionTags(repoDir).sort(), ["v2026.10.1", "v2026.10.9", "v2026.9.1"]);
  });
});

describe("findPreviousVersionTag", () => {
  it("takes the newest release reachable from the sha", () => {
    assert.equal(findPreviousVersionTag(shas.third, "v2026.10.2", repoDir), "v2026.10.1");
    assert.equal(findPreviousVersionTag(shas.fourth, "v2026.10.10", repoDir), "v2026.10.9");
  });

  it("never names the version being cut", () => {
    assert.equal(findPreviousVersionTag(shas.second, "v2026.10.1", repoDir), "v2026.9.1");
  });

  it("returns undefined before the first release", () => {
    assert.equal(findPreviousVersionTag(shas.root, "v2026.9.1", repoDir), undefined);
  });
});

describe("listCommitsSince", () => {
  it("lists the non-merge commits after the tag", () => {
    const subjects = listCommitsSince("v2026.10.1", shas.fourth, repoDir).map(
      (change) => change.subject,
    );
    assert.deepEqual([...subjects].sort(), [
      "feat: side work",
      "feat: third feature",
      "perf: fourth",
    ]);
  });

  it("lists the whole history for a first release, oldest first", () => {
    const changes = listCommitsSince(undefined, shas.first, repoDir);
    assert.deepEqual(
      changes.map((change) => change.subject),
      ["chore: root", "feat: first feature"],
    );
    assert.equal(changes[1].sha, shas.first);
  });
});

describe("listVersionTagsAt", () => {
  it("lists only the release tags on that sha", () => {
    assert.deepEqual(listVersionTagsAt(shas.first, repoDir), ["v2026.9.1"]);
    assert.deepEqual(listVersionTagsAt(shas.third, repoDir), []);
  });
});

describe("ensureReleaseTag", () => {
  let remoteDir;

  before(() => {
    remoteDir = mkdtempSync(path.join(tmpdir(), "vega-release-remote-"));
    execFileSync("git", ["init", "--quiet", "--bare", remoteDir]);
    runGit(["remote", "add", "origin", remoteDir]);
  });

  after(() => rmSync(remoteDir, { recursive: true, force: true }));

  it("creates and pushes an annotated tag", () => {
    const outcome = ensureReleaseTag({ version: "v2026.11.1", sha: shas.fourth, cwd: repoDir });
    assert.equal(outcome, "created");
    assert.equal(runGit(["cat-file", "-t", "v2026.11.1"]), "tag");
    assert.match(runGit(["ls-remote", "--tags", "origin"]), /refs\/tags\/v2026\.11\.1/);
  });

  it("is a no-op when the tag already marks that sha, so a re-run recovers", () => {
    const outcome = ensureReleaseTag({ version: "v2026.11.1", sha: shas.fourth, cwd: repoDir });
    assert.equal(outcome, "existing");
  });

  it("refuses when the tag marks another sha", () => {
    assert.throws(
      () => ensureReleaseTag({ version: "v2026.11.1", sha: shas.third, cwd: repoDir }),
      /already marks/,
    );
  });

  it("deletes the local tag when the push fails", () => {
    runGit(["remote", "set-url", "origin", path.join(remoteDir, "missing")]);
    try {
      assert.throws(
        () => ensureReleaseTag({ version: "v2026.11.2", sha: shas.third, cwd: repoDir }),
        /not tagged, nothing recorded/,
      );
      assert.equal(runGit(["tag", "--list", "v2026.11.2"]), "");
    } finally {
      runGit(["remote", "set-url", "origin", remoteDir]);
    }
  });
});

describe("composeReleaseNotes", () => {
  it("composeReleaseNotes passes isBreakGlass and hostingVersion through", () => {
    const notes = composeReleaseNotes({
      version: "v2026.10.10",
      sha: shas.fourth,
      server: { status: "skipped", reason: "forced by --only=hosting" },
      hosting: { status: "shipped", hostingVersion: "a1b2c3d4" },
      isBreakGlass: true,
      cwd: repoDir,
    });
    assert.match(notes, /^- Path: \*\*break-glass\*\*/m);
    assert.ok(notes.includes(`- Hosting: shipped, build \`${shas.fourth}\`, version \`a1b2c3d4\``));
  });
});
