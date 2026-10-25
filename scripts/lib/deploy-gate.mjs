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
