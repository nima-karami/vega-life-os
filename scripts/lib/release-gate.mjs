// Internal only: `npm run release` sets it for its own deploy steps, so one release runs the local gate once.
export const LOCAL_GATE_ENV = "RELEASE_LOCAL_GATE_SHA";
export const BREAK_GLASS_ENV = "RELEASE_BREAK_GLASS";

// CI may be down, so the laptop runs the whole gate plus the bundle smoke CI runs on the server
// path. Semgrep (SAST) has no local equivalent and stays a gap.
const BREAK_GLASS_GATE = ["verify", "smoke:server-bundle"];

function shortSha(sha) {
  return sha.slice(0, 7);
}

export function chooseLocalGate({ releaseSha, gatedSha, isBreakGlass }) {
  if (gatedSha) {
    if (gatedSha === releaseSha) return { scripts: [] };
    return {
      refusal: `HEAD (${shortSha(releaseSha)}) is not the sha this release gated (${shortSha(gatedSha)})`,
    };
  }
  if (!isBreakGlass) {
    return {
      refusal:
        "the laptop path is break-glass only — the normal path is CI: a deploy.yml dispatch, or a merge to main once auto-deploy is on. During a GitHub outage: npm run release -- --break-glass (standalone: RELEASE_BREAK_GLASS=1 npm run deploy, npm run deploy:server -- --break-glass)",
    };
  }
  return { scripts: BREAK_GLASS_GATE };
}

function findActiveRunUrl(workflow, statuses, listActiveRuns) {
  for (const status of statuses) {
    const activeRuns = listActiveRuns(workflow, status);
    if (activeRuns.length > 0) return activeRuns[0].url;
  }
  return undefined;
}

// Each workflow is read on its own: an unreadable one (deploy.yml 404s until it lands) must not hide another.
export function findActiveCiDeploy({ workflows, statuses, listActiveRuns }) {
  const readErrors = [];
  for (const workflow of workflows) {
    try {
      const activeRunUrl = findActiveRunUrl(workflow, statuses, listActiveRuns);
      if (activeRunUrl) return { activeRunUrl };
    } catch (error) {
      readErrors.push(`${workflow}: ${error.message.split("\n")[0]}`);
    }
  }
  return readErrors.length > 0 ? { readError: readErrors.join("; ") } : {};
}

export function judgeCiDeployCheck({ activeRunUrl, readError }) {
  if (activeRunUrl) return { refusal: `a CI deploy is running: ${activeRunUrl}` };
  if (readError) {
    return {
      warning: `could not confirm that no CI deploy is running (${readError}) — proceeding under --break-glass`,
    };
  }
  return {};
}

export function describeHeadDrift(expectedSha, headSha) {
  if (headSha === expectedSha) return undefined;
  return `HEAD moved from ${shortSha(expectedSha)} to ${shortSha(headSha)} during the release`;
}

function summarizePlan(plan) {
  return JSON.stringify({
    headFullSha: plan.headFullSha,
    version: plan.version,
    record: plan.record,
    targets: plan.targets.map(({ target, shouldDeploy, liveSha }) => ({
      target,
      shouldDeploy,
      liveSha,
    })),
  });
}

export function describePlanDrift(gatedPlan, currentPlan) {
  if (summarizePlan(gatedPlan) === summarizePlan(currentPlan)) return undefined;
  return "the release plan changed while the gate ran (a CI release landed, or HEAD moved). Re-run it";
}
