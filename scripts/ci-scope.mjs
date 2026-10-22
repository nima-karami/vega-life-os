#!/usr/bin/env node
// Prints `scope=docs|web|full` for $GITHUB_OUTPUT. Any doubt (no base, unknown base, git error) → full.
import { classifyCiScope } from "./lib/change-scope.mjs";
import { listChangedFilesSince } from "./lib/git-changes.mjs";

const baseSha = process.argv[2];
const changedFiles = listChangedFilesSince(baseSha, process.cwd());
const scope = classifyCiScope(changedFiles);
console.error(
  `ci-scope: ${scope} (${changedFiles ? `${changedFiles.length} files since ${baseSha}` : "no usable base"})`,
);
console.log(`scope=${scope}`);
