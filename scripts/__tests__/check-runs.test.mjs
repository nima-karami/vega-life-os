import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isGreenCheckRun } from "../lib/check-runs.mjs";

function checkRun(name, conclusion, status = "completed") {
  return { name, status, conclusion };
}

describe("isGreenCheckRun", () => {
  it("success is green, whatever the job", () => {
    assert.equal(isGreenCheckRun(checkRun("static", "success")), true);
  });

  it("skipped is green only for the jobs change detection may skip", () => {
    assert.equal(isGreenCheckRun(checkRun("unit-server", "skipped")), true);
    assert.equal(isGreenCheckRun(checkRun("e2e", "skipped")), true);
    assert.equal(isGreenCheckRun(checkRun("e2e (chromium, 1, 3)", "skipped")), true);
  });

  it("any other skipped check is not green", () => {
    for (const name of ["static", "unit (@vega/web)", "sast", "changes", "e2e-extra"]) {
      assert.equal(isGreenCheckRun(checkRun(name, "skipped")), false, name);
    }
  });

  it("failures and unfinished runs are not green", () => {
    assert.equal(isGreenCheckRun(checkRun("e2e", "failure")), false);
    assert.equal(isGreenCheckRun(checkRun("unit-server", null, "in_progress")), false);
  });
});
