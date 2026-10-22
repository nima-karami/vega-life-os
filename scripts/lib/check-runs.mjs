// verify.yml's change detection may skip only these jobs; a skipped matrix job may carry its matrix in the name.
const NARROWABLE_JOBS = ["unit-server", "e2e"];

function isNarrowableJob(checkName) {
  return NARROWABLE_JOBS.some((job) => checkName === job || checkName.startsWith(`${job} (`));
}

export function isGreenCheckRun(checkRun) {
  if (checkRun.status !== "completed") return false;
  if (checkRun.conclusion === "success") return true;
  return checkRun.conclusion === "skipped" && isNarrowableJob(checkRun.name);
}
