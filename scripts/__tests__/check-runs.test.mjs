import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEPLOY_JOBS, isDeployCheckRun, isGreenCheckRun } from "../lib/check-runs.mjs";
import { REQUIRED_CHECKS } from "../lib/required-checks.mjs";

function checkRun(name, conclusion, status = "completed") {
  return { name, status, conclusion };
}

describe("isGreenCheckRun", () => {
  it("a completed success is green", () => {
    assert.equal(isGreenCheckRun(checkRun("checks", "success")), true);
  });

  it("skipped is never green: verify narrows by step, not by job", () => {
    for (const name of ["checks", "unit-server", "e2e", "sast"]) {
      assert.equal(isGreenCheckRun(checkRun(name, "skipped")), false, name);
    }
  });

  it("failures, cancellations and unfinished runs are not green", () => {
    assert.equal(isGreenCheckRun(checkRun("checks", "failure")), false);
    assert.equal(isGreenCheckRun(checkRun("checks", "cancelled")), false);
    assert.equal(isGreenCheckRun(checkRun("checks", null, "in_progress")), false);
  });
});

describe("isDeployCheckRun", () => {
  it("names deploy.yml's jobs and their called sub-runs", () => {
    for (const name of DEPLOY_JOBS) {
      assert.equal(isDeployCheckRun(checkRun(name, "skipped")), true, name);
    }
    for (const name of [
      "fallback-e2e / e2e",
      "fallback-verify / static",
      "fallback-e2e / e2e-shard (1/4)",
    ]) {
      assert.equal(isDeployCheckRun(checkRun(name, "success")), true, name);
    }
  });

  it("e2e and the other PR check names are not deploy jobs", () => {
    for (const name of [
      "static",
      "unit-web",
      "unit-shared",
      "unit-server",
      "security",
      "e2e",
      "pr-title",
      ...REQUIRED_CHECKS,
    ]) {
      assert.equal(isDeployCheckRun(checkRun(name, "success")), false, name);
    }
  });

  it("leaves look-alike names to the guard", () => {
    for (const name of ["e2e-shard (1/4)", "planner", "server-suite", "gatekeeper"]) {
      assert.equal(isDeployCheckRun(checkRun(name, "success")), false, name);
    }
  });
});
