#!/usr/bin/env node
// deploy.yml's gate (I1 tested tree, I2 current main). Only I/O lives here; the rules are in lib/deploy-gate.mjs.
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { decideDeployGate, findRedRequiredChecks } from "./lib/deploy-gate.mjs";
import { REQUIRED_CHECKS } from "./lib/required-checks.mjs";

class GateReadError extends Error {}

function readCommand(what, command, args) {
  try {
    return execFileSync(command, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    const firstLine = (error.stderr || error.message).toString().trim().split("\n")[0];
    throw new GateReadError(`could not read ${what}: ${firstLine}`);
  }
}

function readMainHeadSha(repository) {
  return readCommand("main HEAD", "gh", [
    "api",
    `repos/${repository}/git/ref/heads/main`,
    "--jq",
    ".object.sha",
  ]);
}

function findMergedPull(repository, sha) {
  const pulls = JSON.parse(
    readCommand("the commit's pull requests", "gh", [
      "api",
      `repos/${repository}/commits/${sha}/pulls`,
    ]),
  );
  const merged = pulls.find(
    (pull) => pull.merged_at && pull.merge_commit_sha === sha && pull.base?.ref === "main",
  );
  return merged ? { number: merged.number, headSha: merged.head.sha } : undefined;
}

function isTreeOfPullHead(sha, mergedPull) {
  readCommand(`PR #${mergedPull.number} head`, "git", [
    "fetch",
    "--no-tags",
    "--depth=1",
    "origin",
    `refs/pull/${mergedPull.number}/head`,
  ]);
  const fetchedSha = readCommand("FETCH_HEAD", "git", ["rev-parse", "FETCH_HEAD"]);
  if (fetchedSha !== mergedPull.headSha) return false;
  const mergeTree = readCommand("the merge tree", "git", ["rev-parse", `${sha}^{tree}`]);
  const headTree = readCommand("the PR head tree", "git", ["rev-parse", "FETCH_HEAD^{tree}"]);
  return mergeTree === headTree;
}

function readHeadCheckRuns(repository, headSha) {
  const lines = readCommand("the PR head check-runs", "gh", [
    "api",
    "--paginate",
    `repos/${repository}/commits/${headSha}/check-runs?per_page=100`,
    "--jq",
    ".check_runs[]",
  ]);
  return lines
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function gatherTreeEvidence(repository, sha) {
  const mergedPull = findMergedPull(repository, sha);
  if (!mergedPull) return { mergedPull, isTreeMatch: undefined, redChecks: [] };
  const isTreeMatch = isTreeOfPullHead(sha, mergedPull);
  const redChecks = isTreeMatch
    ? findRedRequiredChecks(readHeadCheckRuns(repository, mergedPull.headSha), REQUIRED_CHECKS)
    : [];
  return { mergedPull, isTreeMatch, redChecks };
}

function decideFromEnvironment() {
  const { GITHUB_REF: ref, GITHUB_SHA: sha, GITHUB_REPOSITORY: repository } = process.env;
  const mode = process.env.DEPLOY_MODE || "deploy";
  const shortCircuit = decideDeployGate({ ref, sha, mainHeadSha: sha, mode });
  if (shortCircuit.refusal || shortCircuit.decision === "rollback") return shortCircuit;
  const mainHeadSha = readMainHeadSha(repository);
  if (mainHeadSha !== sha) return decideDeployGate({ ref, sha, mainHeadSha, mode });
  return decideDeployGate({ ref, sha, mainHeadSha, mode, ...gatherTreeEvidence(repository, sha) });
}

function writeOutputs(outcome) {
  const lines = `decision=${outcome.decision}\nreason=${outcome.reason.replace(/\n/g, " ")}\n`;
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, lines);
  console.log(`::notice title=deploy gate::${outcome.reason}`);
}

try {
  const outcome = decideFromEnvironment();
  if (outcome.refusal) {
    console.error(`::error title=deploy gate::${outcome.refusal}`);
    process.exitCode = 1;
  } else {
    writeOutputs(outcome);
  }
} catch (error) {
  if (!(error instanceof GateReadError)) throw error;
  console.error(`::error title=deploy gate::${error.message}`);
  process.exitCode = 1;
}
