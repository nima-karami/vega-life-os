#!/usr/bin/env node
// Refuses a laptop release unless it is break-glass from a tree that is exactly the pushed origin/main,
// then runs the whole gate locally: CI deploys every merge, so the laptop is only for a GitHub outage.
// CI's state is reported, never trusted. --sha=<full sha> pins the sha to release.
import { execFileSync, spawnSync } from "node:child_process";
import { isDeployCheckRun, isGreenCheckRun } from "./lib/check-runs.mjs";
import {
  BREAK_GLASS_ENV,
  chooseLocalGate,
  describeHeadDrift,
  LOCAL_GATE_ENV,
} from "./lib/release-gate.mjs";

const isBreakGlass = process.argv.includes("--break-glass") || process.env[BREAK_GLASS_ENV] === "1";
const isAllowRedCiRequested =
  process.argv.includes("--allow-red-ci") || Boolean(process.env.RELEASE_ALLOW_RED_CI);
const pinnedSha = process.argv.find((arg) => arg.startsWith("--sha="))?.slice("--sha=".length);

function run(command, args) {
  return execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trimEnd();
}

function refuse(reason) {
  console.error(`\nrelease-guard: REFUSED — ${reason}\n`);
  process.exit(1);
}

function assertCleanTree() {
  const changes = run("git", ["status", "--porcelain"]);
  if (changes) {
    const listing = changes.split("\n").slice(0, 20).join("\n  ");
    refuse(`the working tree is dirty. Commit or stash first:\n  ${listing}`);
  }
}

function assertHeadIsOriginMain() {
  run("git", ["fetch", "--quiet", "origin", "main"]);
  const head = run("git", ["rev-parse", "HEAD"]);
  const originMain = run("git", ["rev-parse", "origin/main"]);
  if (head !== originMain) {
    refuse(
      `HEAD (${head.slice(0, 7)}) is not origin/main (${originMain.slice(0, 7)}). Push, or check out main and pull.`,
    );
  }
  return head;
}

function resolveGithubRepo() {
  const remote = run("git", ["remote", "get-url", "origin"]);
  const match = remote.match(/github\.com[:/]([^/]+)\/(.+?)(?:\.git)?$/);
  if (!match) throw new Error(`origin (${remote}) is not a GitHub remote`);
  return `${match[1]}/${match[2]}`;
}

function findCiProblems(sha) {
  let checkRuns;
  try {
    const body = run("gh", [
      "api",
      `repos/${resolveGithubRepo()}/commits/${sha}/check-runs?per_page=100`,
    ]);
    checkRuns = JSON.parse(body).check_runs;
  } catch (error) {
    return [`could not read check-runs via gh (${error.message.split("\n")[0]})`];
  }
  const verifyRuns = checkRuns.filter((check) => !isDeployCheckRun(check));
  if (verifyRuns.length === 0) return ["no CI check-runs exist for this commit"];
  return verifyRuns
    .filter((check) => !isGreenCheckRun(check))
    .map((check) => `${check.name}: ${check.status}/${check.conclusion ?? "pending"}`);
}

function reportCiState(sha) {
  const problems = findCiProblems(sha);
  if (problems.length === 0) {
    console.log(`release-guard: CI green for ${sha.slice(0, 7)}`);
    return;
  }
  const detail = problems.map((problem) => `  - ${problem}`).join("\n");
  console.warn(
    `\n${"!".repeat(72)}\nrelease-guard: WARNING — CI is not green for ${sha.slice(0, 7)} (--break-glass); the full gate runs locally\n${detail}\n${"!".repeat(72)}\n`,
  );
}

function chooseGateScripts(sha) {
  const choice = chooseLocalGate({
    releaseSha: sha,
    gatedSha: process.env[LOCAL_GATE_ENV],
    isBreakGlass,
  });
  if (choice.refusal) refuse(choice.refusal);
  return choice.scripts;
}

function runGateScripts(sha, scripts) {
  if (scripts.length === 0) {
    console.log(`release-guard: local gate already passed for ${sha.slice(0, 7)} in this release`);
  }
  for (const script of scripts) {
    console.log(`release-guard: npm run ${script} for ${sha.slice(0, 7)}`);
    const gate = spawnSync("npm", ["run", script], {
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    if (gate.status !== 0) refuse(`npm run ${script} exited ${gate.status}`);
  }
}

function assertHeadUnmoved(releaseSha) {
  const drift = describeHeadDrift(releaseSha, run("git", ["rev-parse", "HEAD"]));
  if (drift) refuse(drift);
}

if (isAllowRedCiRequested) refuse("--allow-red-ci is folded into --break-glass");
assertCleanTree();
const releaseSha = assertHeadIsOriginMain();
if (pinnedSha) assertHeadUnmoved(pinnedSha);
const gateScripts = chooseGateScripts(releaseSha);
reportCiState(releaseSha);
runGateScripts(releaseSha, gateScripts);
assertCleanTree();
assertHeadUnmoved(releaseSha);
console.log(`release-guard: OK — releasing ${releaseSha.slice(0, 7)}`);
