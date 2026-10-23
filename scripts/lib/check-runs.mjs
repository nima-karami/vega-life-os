// release.yml's jobs (and the e2e.yml shards it calls, or a manual e2e run) land on the same
// sha; the guard judges verify.yml only. A called or matrix job carries a suffix in its name.
const RELEASE_JOBS = ["gate", "plan", "e2e", "server", "hosting", "record", "rollback"];

export function isReleaseCheckRun(checkRun) {
  return RELEASE_JOBS.some(
    (job) =>
      checkRun.name === job ||
      checkRun.name.startsWith(`${job} (`) ||
      checkRun.name.startsWith(`${job} / `),
  );
}

// verify.yml narrows by skipping steps inside its one job, never a whole job, so only success is green.
export function isGreenCheckRun(checkRun) {
  return checkRun.status === "completed" && checkRun.conclusion === "success";
}
