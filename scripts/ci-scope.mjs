#!/usr/bin/env node
// Prints `scope=docs|web|full` for $GITHUB_OUTPUT. Any doubt (no base, unknown base, git error) → full.
import { execFileSync } from "node:child_process";
import { classifyCiScope, isCommitSha } from "./lib/change-scope.mjs";

function listChangedFiles(baseSha) {
  if (!isCommitSha(baseSha) || /^0+$/.test(baseSha)) return undefined;
  try {
    return execFileSync("git", ["diff", "--name-only", baseSha, "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })
      .split("\n")
      .filter(Boolean);
  } catch {
    return undefined;
  }
}

const baseSha = process.argv[2];
const changedFiles = listChangedFiles(baseSha);
const scope = classifyCiScope(changedFiles);
console.error(
  `ci-scope: ${scope} (${changedFiles ? `${changedFiles.length} files since ${baseSha}` : "no usable base"})`,
);
console.log(`scope=${scope}`);
