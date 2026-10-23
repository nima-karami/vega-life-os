#!/usr/bin/env node
// Deploys only the targets whose inputs changed since what is live: server first, then hosting.
// --dry-run prints the plan; --plan-json prints it as JSON for CI; --only=server|hosting|both overrides.
// A successful deploy is tagged with the next CalVer version and published as a GitHub Release;
// --no-record deploys unversioned.
import { execFileSync, spawnSync } from "node:child_process";
import { planTarget } from "./lib/change-scope.mjs";
import { listChangedFilesSince } from "./lib/git-changes.mjs";
import {
  fetchHostingBuildSha,
  fetchServerHealth,
  REPO_ROOT,
  resolveApiUrl,
} from "./lib/live-endpoints.mjs";
import { nextVersion } from "./lib/next-version.mjs";
import { composeReleaseNotes, listVersionTags, publishRelease } from "./lib/release-record.mjs";

const ONLY_VALUES = ["server", "hosting", "both"];
const DEPLOY_SCRIPTS = { server: "deploy:server", hosting: "deploy" };

function parseOptions(argv) {
  const onlyArg = argv.find((arg) => arg.startsWith("--only="));
  const only = onlyArg?.slice("--only=".length);
  if (only !== undefined && !ONLY_VALUES.includes(only)) {
    console.error(`release: --only must be one of ${ONLY_VALUES.join("|")} (got "${only}")`);
    process.exit(2);
  }
  return {
    only,
    isDryRun: argv.includes("--dry-run"),
    isPlanJson: argv.includes("--plan-json"),
    isNoRecord: argv.includes("--no-record"),
    allowRedCi: argv.includes("--allow-red-ci") || process.env.RELEASE_ALLOW_RED_CI === "1",
  };
}

function git(args) {
  return execFileSync("git", args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function runReleaseGuard(allowRedCi) {
  const guardArgs = ["scripts/release-guard.mjs", ...(allowRedCi ? ["--allow-red-ci"] : [])];
  const guard = spawnSync(process.execPath, guardArgs, { cwd: REPO_ROOT, stdio: "inherit" });
  if (guard.status !== 0) process.exit(guard.status ?? 1);
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

function computeNextVersion() {
  try {
    git(["fetch", "--tags", "--quiet", "origin"]);
  } catch (error) {
    console.error(`release: could not fetch tags, numbering from local tags (${error.message})`);
  }
  return nextVersion(listVersionTags(REPO_ROOT), new Date());
}

async function buildReleasePlan(only) {
  const headSha = git(["rev-parse", "--short", "HEAD"]);
  const version = computeNextVersion();
  const liveByTarget = {
    server: await readLiveServerSha(),
    hosting: await readLiveHostingSha(),
  };
  const targets = Object.entries(liveByTarget).map(([target, { liveSha, detail }]) => ({
    ...planTarget({
      target,
      liveSha,
      changedFiles: listChangedFilesSince(liveSha, REPO_ROOT),
      only,
    }),
    liveSha: liveSha ?? null,
    liveShaSource: detail,
  }));
  return { headSha, version, targets };
}

function printPlan({ headSha, version, targets }) {
  console.log(`\nrelease plan for HEAD ${headSha} (next version ${version})`);
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

function runDeploy(target, { allowRedCi, version }) {
  const script = DEPLOY_SCRIPTS[target];
  const passthrough = target === "server" && allowRedCi ? ["--", "--allow-red-ci"] : [];
  console.log(`release: npm run ${script}`);
  const deploy = spawnSync("npm", ["run", script, ...passthrough], {
    cwd: REPO_ROOT,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      ...(version ? { VEGA_VERSION: version } : {}),
      ...(allowRedCi ? { RELEASE_ALLOW_RED_CI: "1" } : {}),
    },
  });
  if (deploy.status !== 0) {
    console.error(`\nrelease: FAILED — npm run ${script} exited ${deploy.status}`);
    process.exit(deploy.status ?? 1);
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

async function recordRelease({ headSha, version, targets }) {
  const describeTarget = (target) => ({
    status: targets.find((plan) => plan.target === target).shouldDeploy ? "shipped" : "skipped",
  });
  const notes = composeReleaseNotes({
    version,
    sha: headSha,
    server: describeTarget("server"),
    hosting: describeTarget("hosting"),
    schemaHash: await readLiveSchemaHash(),
    cwd: REPO_ROOT,
  });
  try {
    publishRelease({ version, sha: headSha, notes, cwd: REPO_ROOT });
  } catch (error) {
    console.error(`\nrelease: deployed, but recording ${version} failed (${error.message})`);
    console.error("  The tag may already be pushed; finish with `gh release create` by hand.");
    process.exit(1);
  }
}

const options = parseOptions(process.argv.slice(2));
const isPlanOnly = options.isDryRun || options.isPlanJson;
if (!isPlanOnly) runReleaseGuard(options.allowRedCi);

const plan = await buildReleasePlan(options.only);
if (options.isPlanJson) {
  console.log(JSON.stringify(plan, null, 2));
  process.exit(0);
}
printPlan(plan);

const deployTargets = plan.targets
  .filter((target) => target.shouldDeploy)
  .map(({ target }) => target);
if (deployTargets.length === 0) {
  console.log("release: nothing to deploy — production already serves everything that changed.");
  process.exit(0);
}
const version = options.isNoRecord ? undefined : plan.version;
const recordNote = version ? `as ${version}` : "unversioned (--no-record)";
if (options.isDryRun) {
  console.log(`release: dry run — would deploy ${deployTargets.join(", then ")} ${recordNote}`);
  process.exit(0);
}
for (const target of deployTargets) runDeploy(target, { allowRedCi: options.allowRedCi, version });
if (version) await recordRelease(plan);
console.log(`release: OK — ${plan.headSha} deployed to ${deployTargets.join(" + ")} ${recordNote}`);
