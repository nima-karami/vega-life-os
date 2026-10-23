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

export function listVersionTagsAt(sha, cwd) {
  return keepVersionTags(runGit(["tag", "--list", "v*", "--points-at", sha], cwd));
}

export function composeReleaseNotes({ version, sha, server, hosting, schemaHash, runUrl, cwd }) {
  const previousTag = findPreviousVersionTag(sha, version, cwd);
  return buildReleaseNotes({
    previousTag,
    commits: previousTag ? listCommitsSince(previousTag, sha, cwd) : [],
    manifest: buildDeployManifest({ sha, server, hosting, schemaHash, runUrl }),
  });
}

function resolveTaggedCommit(version, cwd) {
  try {
    return runGit(["rev-parse", "--verify", "--quiet", `refs/tags/${version}^{commit}`], cwd);
  } catch {
    return undefined;
  }
}

export function ensureReleaseTag({ version, sha, cwd }) {
  const releasedCommit = runGit(["rev-parse", "--verify", `${sha}^{commit}`], cwd);
  const taggedCommit = resolveTaggedCommit(version, cwd);
  if (taggedCommit === releasedCommit) return "existing";
  if (taggedCommit) {
    throw new Error(`tag ${version} already marks ${taggedCommit}, not ${releasedCommit}`);
  }
  runGit(["tag", "-a", version, "-m", version, releasedCommit], cwd);
  try {
    runGit(["push", "origin", `refs/tags/${version}`], cwd);
  } catch (error) {
    runGit(["tag", "-d", version], cwd);
    throw new Error(
      `could not push tag ${version}: not tagged, nothing recorded (${error.message})`,
    );
  }
  return "created";
}

function hasGithubRelease(version, cwd) {
  try {
    execFileSync("gh", ["release", "view", version, "--json", "tagName"], {
      cwd,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

export function ensureGithubRelease({ version, notes, cwd }) {
  if (hasGithubRelease(version, cwd)) return "existing";
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
  return "created";
}
