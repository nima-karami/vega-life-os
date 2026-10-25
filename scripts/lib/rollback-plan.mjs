import { compareVersionTags, parseVersionTag } from "./next-version.mjs";
import { parseDeployManifest } from "./release-notes.mjs";

// Hosting goes back first, so no client is left writing fields the older server would strip.
const ROLLBACK_TARGETS = [
  { target: "hosting", idKey: "hostingVersion", idName: "hosting version" },
  { target: "server", idKey: "revision", idName: "server revision" },
];
const RUNBOOK = "docs/release-process.md §6";

function sortNewestFirst(releases) {
  return releases
    .filter((release) => parseVersionTag(release.tagName))
    .map((release) => ({ tagName: release.tagName, manifest: parseDeployManifest(release.body) }))
    .filter(hasShippedTarget)
    .sort((left, right) => compareVersionTags(right.tagName, left.tagName));
}

// A release that shipped nothing never changed what is live, so it can't be the one rolled back.
function hasShippedTarget({ manifest }) {
  return ROLLBACK_TARGETS.some(({ target }) => manifest[target].isShipped);
}

function planTargetStep(current, olderReleases, { target, idKey, idName }) {
  if (!current.manifest[target].isShipped) return undefined;
  const previous = olderReleases.find((release) => release.manifest[target].isShipped);
  if (!previous) return { refusal: `no release before ${current.tagName} shipped ${target}` };
  const id = previous.manifest[target][idKey];
  if (!id) {
    return {
      refusal: `${previous.tagName} recorded no ${idName} — roll back by hand (${RUNBOOK})`,
    };
  }
  return { step: { target, toVersion: previous.tagName, id } };
}

export function planRollback(releases) {
  const [current, ...olderReleases] = sortNewestFirst(releases);
  if (!current) return { refusal: "no versioned releases" };
  const steps = [];
  for (const rollbackTarget of ROLLBACK_TARGETS) {
    const outcome = planTargetStep(current, olderReleases, rollbackTarget);
    if (outcome?.refusal) return { refusal: outcome.refusal };
    if (outcome) steps.push(outcome.step);
  }
  return { fromVersion: current.tagName, steps };
}
