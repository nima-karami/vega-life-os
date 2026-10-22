import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { classifyCiScope, planTarget } from "../lib/change-scope.mjs";
import { listChangedFilesSince } from "../lib/git-changes.mjs";

let repoDir;
let baseSha;

function runGit(args) {
  return execFileSync(
    "git",
    ["-c", "user.name=test", "-c", "user.email=test@example.com", ...args],
    { cwd: repoDir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  ).trim();
}

before(() => {
  repoDir = mkdtempSync(path.join(tmpdir(), "vega-git-changes-"));
  runGit(["init", "--quiet"]);
  mkdirSync(path.join(repoDir, "apps", "server"), { recursive: true });
  writeFileSync(path.join(repoDir, "apps", "server", "handler.ts"), "export const answer = 42;\n");
  runGit(["add", "."]);
  runGit(["commit", "--quiet", "--no-verify", "-m", "base"]);
  baseSha = runGit(["rev-parse", "--short", "HEAD"]);
  mkdirSync(path.join(repoDir, "docs"));
  runGit(["mv", "apps/server/handler.ts", "docs/handler.ts"]);
  runGit(["commit", "--quiet", "--no-verify", "-m", "move"]);
});

after(() => rmSync(repoDir, { recursive: true, force: true }));

describe("listChangedFilesSince", () => {
  it("lists both sides of a rename", () => {
    assert.deepEqual(listChangedFilesSince(baseSha, repoDir).sort(), [
      "apps/server/handler.ts",
      "docs/handler.ts",
    ]);
  });

  it("a move out of a slice still deploys and tests that slice", () => {
    const changedFiles = listChangedFilesSince(baseSha, repoDir);
    assert.equal(
      planTarget({ target: "server", liveSha: baseSha, changedFiles }).shouldDeploy,
      true,
    );
    assert.equal(classifyCiScope(changedFiles), "full");
  });

  it("returns undefined for a sha not in history", () => {
    assert.equal(listChangedFilesSince("abcdef1234", repoDir), undefined);
  });

  it("never hands git a non-sha argument", () => {
    for (const liveSha of ["--output=pwned", "-p", "HEAD~1", "dev", undefined]) {
      assert.equal(listChangedFilesSince(liveSha, repoDir), undefined, String(liveSha));
    }
  });
});
