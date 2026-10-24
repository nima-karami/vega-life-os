#!/usr/bin/env node
// Refuses a release from a tree that is not exactly the pushed, CI-checked origin/main, then runs
// locally what CI did not prove for it: e2e (CI runs it only inside release.yml), or the whole
// gate when CI is red and --allow-red-ci was passed. --sha=<full sha> pins the sha to release.
import { execFileSync, spawnSync } from "node:child_process";
import { isGreenCheckRun, isReleaseCheckRun } from "./lib/check-runs.mjs";
import { chooseLocalGate, describeHeadDrift, LOCAL_GATE_ENV } from "./lib/release-gate.mjs";

const allowRedCi =
  process.argv.includes("--allow-red-ci") || process.env.RELEASE_ALLOW_RED_CI === "1";
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
  if (!match) refuse(`origin (${remote}) is not a GitHub remote`);
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
  const verifyRuns = checkRuns.filter((check) => !isReleaseCheckRun(check));
  if (verifyRuns.length === 0) return ["no CI check-runs exist for this commit"];
  return verifyRuns
    .filter((check) => !isGreenCheckRun(check))
    .map((check) => `${check.name}: ${check.status}/${check.conclusion ?? "pending"}`);
}

function checkCiGreen(sha) {
  const problems = findCiProblems(sha);
  if (problems.length === 0) {
    console.log(`release-guard: CI green for ${sha.slice(0, 7)}`);
    return true;
  }
  const detail = problems.map((problem) => `  - ${problem}`).join("\n");
  if (!allowRedCi) refuse(`CI is not green for ${sha.slice(0, 7)}:\n${detail}`);
  console.warn(
    `\n${"!".repeat(72)}\nrelease-guard: WARNING — CI is RED (--allow-red-ci); running the full gate locally\n${detail}\n${"!".repeat(72)}\n`,
  );
  return false;
}

function runLocalGate(sha, isCiGreen) {
  const choice = chooseLocalGate({
    releaseSha: sha,
    gatedSha: process.env[LOCAL_GATE_ENV],
    isCiGreen,
  });
  if (choice.refusal) refuse(choice.refusal);
  if (choice.scripts.length === 0) {
    console.log(`release-guard: local gate already passed for ${sha.slice(0, 7)} in this release`);
  }
  for (const script of choice.scripts) {
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

assertCleanTree();
const releaseSha = assertHeadIsOriginMain();
if (pinnedSha) assertHeadUnmoved(pinnedSha);
runLocalGate(releaseSha, checkCiGreen(releaseSha));
assertCleanTree();
assertHeadUnmoved(releaseSha);
console.log(`release-guard: OK — releasing ${releaseSha.slice(0, 7)}`);
