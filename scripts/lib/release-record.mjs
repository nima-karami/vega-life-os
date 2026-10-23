import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runGit } from "./git-changes.mjs";
import { compareVersionTags, parseVersionTag } from "./next-version.mjs";
import { buildDeployManifest, buildReleaseNotes } from "./release-notes.mjs";

const FIELD_SEPARATOR = "\x1f";

function keepVersionTags(output) {
  return output.split("\n").filter((tag) => parseVersionTag(tag));
}

export function listVersionTags(cwd) {
  return keepVersionTags(runGit(["tag", "--list", "v*"], cwd));
}

export function findPreviousVersionTag(sha, version, cwd) {
  const reachableTags = keepVersionTags(runGit(["tag", "--list", "v*", "--merged", sha], cwd));
  return reachableTags
    .filter((tag) => tag !== version)
    .sort(compareVersionTags)
    .at(-1);
}

export function listCommitsSince(previousTag, sha, cwd) {
  const range = previousTag ? `${previousTag}..${sha}` : sha;
  const log = runGit(
    ["log", "--no-merges", "--reverse", `--format=%h${FIELD_SEPARATOR}%s`, range],
    cwd,
  );
  return log
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [commitSha, subject] = line.split(FIELD_SEPARATOR);
      return { sha: commitSha, subject };
    });
}

export function composeReleaseNotes({ version, sha, server, hosting, schemaHash, runUrl, cwd }) {
  const previousTag = findPreviousVersionTag(sha, version, cwd);
  return buildReleaseNotes({
    previousTag,
    commits: listCommitsSince(previousTag, sha, cwd),
    manifest: buildDeployManifest({ sha, server, hosting, schemaHash, runUrl }),
  });
}

export function publishRelease({ version, sha, notes, cwd }) {
  runGit(["tag", "-a", version, "-m", version, sha], cwd);
  runGit(["push", "origin", `refs/tags/${version}`], cwd);
  const notesDir = mkdtempSync(path.join(tmpdir(), "vega-release-notes-"));
  try {
    const notesFile = path.join(notesDir, `${version}.md`);
    writeFileSync(notesFile, notes);
    execFileSync(
      "gh",
      ["release", "create", version, "--title", version, "--notes-file", notesFile, "--verify-tag"],
      { cwd, stdio: "inherit" },
    );
  } finally {
    rmSync(notesDir, { recursive: true, force: true });
  }
}
