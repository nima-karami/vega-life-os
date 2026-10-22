// verify.yml's change detection may skip only these jobs; a skipped matrix job may carry its matrix in the name.
const NARROWABLE_JOBS = ["unit-server", "e2e"];

function isNarrowableJob(checkName) {
  return NARROWABLE_JOBS.some((job) => checkName === job || checkName.startsWith(`${job} (`));
}

// release.yml's own jobs land on the same sha; the guard judges verify.yml only.
const RELEASE_JOBS = ["gate", "plan", "server", "hosting", "rollback"];

export function isReleaseCheckRun(checkRun) {
  return RELEASE_JOBS.includes(checkRun.name);
}

export function isGreenCheckRun(checkRun) {
  if (checkRun.status !== "completed") return false;
  if (checkRun.conclusion === "success") return true;
  return checkRun.conclusion === "skipped" && isNarrowableJob(checkRun.name);
}
