import { isGreenCheckRun } from "./check-runs.mjs";

const GITHUB_ACTIONS_SLUG = "github-actions";

function shortSha(sha) {
  return sha.slice(0, 7);
}

function findLatestRunsByName(headCheckRuns) {
  const latestByName = new Map();
  for (const checkRun of headCheckRuns) {
    if (checkRun.app?.slug !== GITHUB_ACTIONS_SLUG) continue;
    const latest = latestByName.get(checkRun.name);
    if (!latest || checkRun.id > latest.id) latestByName.set(checkRun.name, checkRun);
  }
  return latestByName;
}

export function findRedRequiredChecks(headCheckRuns, requiredChecks) {
  const latestByName = findLatestRunsByName(headCheckRuns);
  return requiredChecks.flatMap((name) => {
    const checkRun = latestByName.get(name);
    if (!checkRun) return [`${name}: missing`];
    if (isGreenCheckRun(checkRun)) return [];
    return [`${name}: ${checkRun.status}/${checkRun.conclusion ?? "pending"}`];
  });
}

function judgeTestedTree({ sha, mergedPull, isTreeMatch, redChecks }) {
  if (!mergedPull) {
    return {
      decision: "verify-first",
      reason: `tree not tested: ${shortSha(sha)} came from no merged PR`,
    };
  }
  const pullHead = `PR #${mergedPull.number} head ${shortSha(mergedPull.headSha)}`;
  if (!isTreeMatch) {
    return {
      decision: "verify-first",
      reason: `tree not tested: ${shortSha(sha)} differs from ${pullHead}`,
    };
  }
  if (redChecks.length > 0) {
    return {
      decision: "verify-first",
      reason: `checks red on ${pullHead}: ${redChecks.join(", ")}`,
    };
  }
  return { decision: "deploy", reason: `tested tree: ${pullHead}, all required checks green` };
}

export function decideDeployGate({
  ref,
  sha,
  mainHeadSha,
  mode,
  mergedPull,
  isTreeMatch,
  redChecks,
}) {
  if (ref !== "refs/heads/main") return { refusal: `not main: ${ref}` };
  if (mode === "rollback") return { decision: "rollback", reason: "rollback dispatch" };
  if (sha !== mainHeadSha) {
    return {
      decision: "stale",
      reason: `sha ${shortSha(sha)} is no longer main HEAD (${shortSha(mainHeadSha)}) — nothing to deploy`,
    };
  }
  return judgeTestedTree({ sha, mergedPull, isTreeMatch, redChecks });
}

// "Re-run failed jobs" skips the gate and reuses its outputs, so each credentialed job re-checks I2.
export function judgeMainHead({ ref, sha, mainHeadSha, mode }) {
  if (ref !== "refs/heads/main") return { refusal: `not main: ${ref}` };
  if (mode === "rollback") return { reason: "rollback dispatch: main HEAD not required" };
  if (sha !== mainHeadSha) {
    return {
      refusal: `sha ${shortSha(sha)} is no longer main HEAD (${shortSha(mainHeadSha)}) — a re-run of an old deploy must not touch production`,
    };
  }
  return { reason: `sha ${shortSha(sha)} is main HEAD` };
}

const RUNBOOK = "docs/release-process.md §6";

function describeUnreadable(what) {
  return `${what} — production may not be restored; roll back by hand (${RUNBOOK})`;
}

// Unreadable is never "someone else's": a human must learn that production was not restored.
export function judgeHostingRevert({
  liveVersion,
  liveBuildSha,
  promotedVersion,
  previousVersion,
  shortSha: runSha,
}) {
  const isOurVersion = Boolean(promotedVersion) && liveVersion === promotedVersion;
  const isOurBuild = Boolean(runSha) && liveBuildSha === runSha;
  if (isOurVersion || isOurBuild) {
    return {
      shouldRevert: true,
      isUnreadable: false,
      isHostingPrevious: false,
      reason: `live hosting is this run's (${liveVersion || liveBuildSha})`,
    };
  }
  if (Boolean(previousVersion) && liveVersion === previousVersion) {
    return {
      shouldRevert: false,
      isUnreadable: false,
      isHostingPrevious: true,
      reason: `live hosting is already the previous version ${previousVersion} — nothing to revert`,
    };
  }
  const isKnownOther = Boolean(liveBuildSha) || (Boolean(promotedVersion) && Boolean(liveVersion));
  if (!isKnownOther) {
    return {
      shouldRevert: false,
      isUnreadable: true,
      isHostingPrevious: false,
      reason: describeUnreadable(
        `cannot tell whose hosting is live (version ${liveVersion || "unknown"}, build unknown, this run promoted ${promotedVersion || "an unrecorded version"})`,
      ),
    };
  }
  return {
    shouldRevert: false,
    isUnreadable: false,
    isHostingPrevious: false,
    reason: `live hosting is ${liveVersion || "unknown"} (build ${liveBuildSha || "unknown"}), not this run's ${promotedVersion || "?"} / ${runSha} — leaving it`,
  };
}

export function judgeTrafficRevert({ servingTraffic, runRevision }) {
  const servingRevisions = servingTraffic
    .split(",")
    .filter(Boolean)
    .map((entry) => entry.split("=")[0]);
  if (!runRevision || servingRevisions.length === 0) {
    return {
      shouldRevert: false,
      isUnreadable: true,
      reason: describeUnreadable(
        `cannot tell whose revision serves (serving ${servingTraffic || "unknown"}, this run's ${runRevision || "unrecorded"})`,
      ),
    };
  }
  if (servingRevisions.every((revision) => revision === runRevision)) {
    return { shouldRevert: true, isUnreadable: false, reason: `${runRevision} serves all traffic` };
  }
  return {
    shouldRevert: false,
    isUnreadable: false,
    reason: `serving ${servingTraffic}, not this run's ${runRevision} — leaving traffic`,
  };
}
