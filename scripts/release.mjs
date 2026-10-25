#!/usr/bin/env node
// Deploys only the targets whose inputs changed since what is live: server first, then hosting.
// The laptop path is break-glass only (--break-glass): the guard runs the full gate locally, once,
// after the plan finds work.
// --dry-run prints the plan; --plan-json prints it as JSON for CI; --only=server|hosting|both overrides.
// A successful deploy is tagged with the next CalVer version and published as a GitHub Release;
// --no-record deploys unversioned. A sha that already carries a version re-deploys as that version.
import { execFileSync, spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { planTarget } from "./lib/change-scope.mjs";
import { listChangedFilesSince } from "./lib/git-changes.mjs";
import {
  fetchHostingBuildSha,
  fetchServerHealth,
  REPO_ROOT,
  resolveApiUrl,
} from "./lib/live-endpoints.mjs";
import { resolveReleaseVersion } from "./lib/next-version.mjs";
import {
  BREAK_GLASS_ENV,
  describeHeadDrift,
  describePlanDrift,
  findActiveCiDeploy,
  judgeCiDeployCheck,
} from "./lib/release-gate.mjs";
import {
  composeReleaseNotes,
  ensureGithubRelease,
  ensureReleaseTag,
  listVersionTags,
  listVersionTagsAt,
} from "./lib/release-record.mjs";

const ONLY_VALUES = ["server", "hosting", "both"];
const DEPLOY_SCRIPTS = { server: "deploy:server", hosting: "deploy" };
const ACTIVE_RUN_STATUSES = ["queued", "in_progress", "waiting", "pending", "requested"];
const CI_DEPLOY_WORKFLOWS = ["deploy.yml", "release.yml"];

// Thrown instead of process.exit: exiting while fetch sockets close trips a libuv assertion on Windows.
class ReleaseExit extends Error {
  constructor(message, exitCode) {
    super(message);
    this.exitCode = exitCode;
  }
}

function parseOptions(argv) {
  const onlyArg = argv.find((arg) => arg.startsWith("--only="));
  const only = onlyArg?.slice("--only=".length);
  if (only !== undefined && !ONLY_VALUES.includes(only)) {
    throw new ReleaseExit(
      `release: --only must be one of ${ONLY_VALUES.join("|")} (got "${only}")`,
      2,
    );
  }
  if (argv.includes("--allow-red-ci")) {
    throw new ReleaseExit("release: --allow-red-ci is folded into --break-glass", 2);
  }
  return {
    only,
    isDryRun: argv.includes("--dry-run"),
    isPlanJson: argv.includes("--plan-json"),
    isNoRecord: argv.includes("--no-record"),
    isBreakGlass: argv.includes("--break-glass"),
  };
}

function git(args) {
  return execFileSync("git", args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function runReleaseGuard({ isBreakGlass, sha }) {
  const guardArgs = [
    "scripts/release-guard.mjs",
    `--sha=${sha}`,
    ...(isBreakGlass ? ["--break-glass"] : []),
  ];
  const guard = spawnSync(process.execPath, guardArgs, { cwd: REPO_ROOT, stdio: "inherit" });
  if (guard.status !== 0) throw new ReleaseExit("", guard.status ?? 1);
}

function assertHeadIs(gatedSha) {
  const drift = describeHeadDrift(gatedSha, git(["rev-parse", "HEAD"]));
  if (drift) refuse(drift);
}

async function readLiveServerSha() {
  const api = resolveApiUrl();
  if (!api) return { liveSha: undefined, detail: "no server URL configured" };
  try {
    const health = await fetchServerHealth(api.url);
    return { liveSha: health.sha, detail: `/health via ${api.source}` };
  } catch (error) {
    return { liveSha: undefined, detail: `/health unreachable (${error.message})` };
  }
}

async function readLiveHostingSha() {
  try {
    return { liveSha: await fetchHostingBuildSha(), detail: "vega-build meta" };
  } catch (error) {
    return { liveSha: undefined, detail: `site unreachable (${error.message})` };
  }
}

function computeReleaseVersion(headFullSha) {
  try {
    git(["fetch", "--tags", "--quiet", "origin"]);
  } catch (error) {
    console.error(`release: could not fetch tags, numbering from local tags (${error.message})`);
  }
  return resolveReleaseVersion({
    headTags: listVersionTagsAt(headFullSha, REPO_ROOT),
    allTags: listVersionTags(REPO_ROOT),
    now: new Date(),
  });
}

async function buildReleasePlan(only) {
  const headFullSha = git(["rev-parse", "HEAD"]);
  const headSha = git(["rev-parse", "--short", headFullSha]);
  const { version, isNew } = computeReleaseVersion(headFullSha);
  const liveByTarget = {
    server: await readLiveServerSha(),
    hosting: await readLiveHostingSha(),
  };
  const targets = Object.entries(liveByTarget).map(([target, { liveSha, detail }]) => ({
    ...planTarget({
      target,
      liveSha,
      changedFiles: listChangedFilesSince(liveSha, REPO_ROOT, headFullSha),
      only,
    }),
    liveSha: liveSha ?? null,
    liveShaSource: detail,
  }));
  return { headFullSha, headSha, version, record: isNew, targets };
}

function printPlan({ headSha, version, record, targets }) {
  const versionNote = record ? `next version ${version}` : `already ${version}`;
  console.log(`\nrelease plan for HEAD ${headSha} (${versionNote})`);
  for (const plan of targets) {
    const verdict = plan.shouldDeploy ? "DEPLOY" : "skip  ";
    console.log(
      `  ${verdict} ${plan.target.padEnd(8)} live ${plan.liveSha ?? "?"} — ${plan.reason}`,
    );
    console.log(`         ${"".padEnd(8)} live sha from ${plan.liveShaSource}`);
    for (const filePath of plan.relevantFiles.slice(0, 10)) console.log(`           ${filePath}`);
    if (plan.relevantFiles.length > 10) {
      console.log(`           … and ${plan.relevantFiles.length - 10} more`);
    }
  }
  console.log("");
}

function runDeploy(target, { isBreakGlass, version, gatedSha }) {
  const script = DEPLOY_SCRIPTS[target];
  const passthrough = target === "server" && isBreakGlass ? ["--", "--break-glass"] : [];
  console.log(`release: npm run ${script}`);
  const deploy = spawnSync("npm", ["run", script, ...passthrough], {
    cwd: REPO_ROOT,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      RELEASE_LOCAL_GATE_SHA: gatedSha,
      ...(version ? { VEGA_VERSION: version } : {}),
      ...(isBreakGlass ? { [BREAK_GLASS_ENV]: "1" } : {}),
    },
  });
  if (deploy.status !== 0) {
    throw new ReleaseExit(
      `\nrelease: FAILED — npm run ${script} exited ${deploy.status}`,
      deploy.status ?? 1,
    );
  }
}

async function readLiveSchemaHash() {
  const api = resolveApiUrl();
  if (!api) return undefined;
  try {
    return (await fetchServerHealth(api.url)).schemaHash;
  } catch {
    return undefined;
  }
}

function refuse(reason) {
  throw new ReleaseExit(`\nrelease: REFUSED — ${reason}`, 1);
}

function readGhJson(args) {
  return JSON.parse(
    execFileSync("gh", args, {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }),
  );
}

function listActiveRuns(workflow, status) {
  return readGhJson([
    "run",
    "list",
    "--workflow",
    workflow,
    "--status",
    status,
    "--limit",
    "1",
    "--json",
    "url",
  ]);
}

// Two deploys at once would race for one version number and one live revision.
function refuseWhileCiDeployRuns() {
  const outcome = judgeCiDeployCheck(
    findActiveCiDeploy({
      workflows: CI_DEPLOY_WORKFLOWS,
      statuses: ACTIVE_RUN_STATUSES,
      listActiveRuns,
    }),
  );
  if (outcome.refusal) refuse(outcome.refusal);
  if (outcome.warning) console.warn(`release: WARNING — ${outcome.warning}`);
}

function refuseWithoutGhAuth() {
  const auth = spawnSync("gh", ["auth", "status"], { cwd: REPO_ROOT, stdio: "ignore" });
  if (auth.status !== 0) refuse("recording needs `gh auth login` (or pass --no-record)");
}

async function recordRelease({ headSha, version, targets }, { isBreakGlass }) {
  const describeTarget = (target) => {
    const plan = targets.find((candidate) => candidate.target === target);
    return plan.shouldDeploy ? { status: "shipped" } : { status: "skipped", reason: plan.reason };
  };
  const notes = composeReleaseNotes({
    version,
    sha: headSha,
    server: describeTarget("server"),
    hosting: describeTarget("hosting"),
    schemaHash: await readLiveSchemaHash(),
    isBreakGlass,
    cwd: REPO_ROOT,
  });
  try {
    ensureReleaseTag({ version, sha: headSha, cwd: REPO_ROOT });
  } catch (error) {
    throw new ReleaseExit(`\nrelease: deployed, but ${error.message}`, 1);
  }
  try {
    ensureGithubRelease({ version, notes, cwd: REPO_ROOT });
  } catch (error) {
    const notesFile = path.join(tmpdir(), `vega-${version}-notes.md`);
    writeFileSync(notesFile, notes);
    throw new ReleaseExit(
      `\nrelease: deployed and tagged ${version}, but the GitHub Release failed (${error.message}).\n` +
        `  Finish it: gh release create ${version} --title ${version} --notes-file "${notesFile}" --verify-tag`,
      1,
    );
  }
}

// Re-planned after the guard: a CI release or a moved HEAD during the local e2e run changes the plan.
async function assertPlanUnchanged(gatedPlan, only) {
  const drift = describePlanDrift(gatedPlan, await buildReleasePlan(only));
  if (drift) refuse(drift);
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const plan = await buildReleasePlan(options.only);
  if (options.isPlanJson) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }
  printPlan(plan);

  const deployTargets = plan.targets
    .filter((target) => target.shouldDeploy)
    .map(({ target }) => target);
  if (deployTargets.length === 0) {
    console.log("release: nothing to deploy — production already serves everything that changed.");
    return;
  }
  const shouldRecord = plan.record && !options.isNoRecord;
  const version = plan.record && options.isNoRecord ? undefined : plan.version;
  const recordNote = version ? `as ${version}` : "unversioned (--no-record)";
  if (!plan.record) {
    console.log(
      `release: sha ${plan.headSha} is already ${plan.version} — re-deploying as ${plan.version}, nothing recorded`,
    );
  }
  if (options.isDryRun) {
    console.log(`release: dry run — would deploy ${deployTargets.join(", then ")} ${recordNote}`);
    return;
  }
  const gatedSha = plan.headFullSha;
  // After the plan, so a release with nothing to ship never pays for the local e2e run.
  runReleaseGuard({ isBreakGlass: options.isBreakGlass, sha: gatedSha });
  await assertPlanUnchanged(plan, options.only);
  if (shouldRecord) refuseWithoutGhAuth();
  for (const target of deployTargets) {
    refuseWhileCiDeployRuns();
    assertHeadIs(gatedSha);
    runDeploy(target, { isBreakGlass: options.isBreakGlass, version, gatedSha });
  }
  if (shouldRecord) {
    assertHeadIs(gatedSha);
    await recordRelease(plan, { isBreakGlass: options.isBreakGlass });
  }
  console.log(
    `release: OK — ${plan.headSha} deployed to ${deployTargets.join(" + ")} ${recordNote}`,
  );
}

try {
  await main();
} catch (error) {
  if (!(error instanceof ReleaseExit)) throw error;
  if (error.message) console.error(error.message);
  process.exitCode = error.exitCode;
}
