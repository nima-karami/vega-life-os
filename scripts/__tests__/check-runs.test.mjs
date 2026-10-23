import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isGreenCheckRun, isReleaseCheckRun } from "../lib/check-runs.mjs";

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

describe("isReleaseCheckRun", () => {
  it("names release.yml's jobs", () => {
    for (const name of ["gate", "plan", "e2e", "server", "hosting", "record", "rollback"]) {
      assert.equal(isReleaseCheckRun(checkRun(name, "skipped")), true, name);
    }
  });

  it("names the e2e shards release.yml calls, and a manual e2e.yml run", () => {
    for (const name of ["e2e / e2e (1/3)", "e2e / e2e (3/3)", "e2e (2/3)"]) {
      assert.equal(isReleaseCheckRun(checkRun(name, "success")), true, name);
    }
  });

  it("leaves verify.yml's job and look-alike names to the guard", () => {
    for (const name of ["checks", "e2e-extra", "planner", "server-suite", "unit (@vega/web)"]) {
      assert.equal(isReleaseCheckRun(checkRun(name, "success")), false, name);
    }
  });
});
