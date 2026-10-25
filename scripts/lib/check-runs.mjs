// deploy.yml's jobs (and the verify/e2e runs its fallback calls) land on the same main sha; the
// guard judges the rest. A called or matrix job carries a suffix in its name.
export const DEPLOY_JOBS = [
  "gate",
  "fallback-verify",
  "fallback-e2e",
  "plan",
  "server",
  "hosting",
  "smoke",
  "promote",
  "record",
  "rollback",
  "restore",
];

export function isDeployCheckRun(checkRun) {
  return DEPLOY_JOBS.some(
    (job) =>
      checkRun.name === job ||
      checkRun.name.startsWith(`${job} (`) ||
      checkRun.name.startsWith(`${job} / `),
  );
}

// Scope narrowing skips steps inside a job, never a whole job, so only success is green.
export function isGreenCheckRun(checkRun) {
  return checkRun.status === "completed" && checkRun.conclusion === "success";
}
