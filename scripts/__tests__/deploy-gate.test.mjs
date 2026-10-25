import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decideDeployGate, findRedRequiredChecks } from "../lib/deploy-gate.mjs";
import { REQUIRED_CHECKS } from "../lib/required-checks.mjs";

const MAIN_SHA = "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678";
const OLD_SHA = "0f1e2d3c4b5a69788796a5b4c3d2e1f098765432";
const PR_HEAD_SHA = "9988776655443322110099887766554433221100";
const MERGED_PULL = { number: 42, headSha: PR_HEAD_SHA };

function gateInput(overrides = {}) {
  return {
    ref: "refs/heads/main",
    sha: MAIN_SHA,
    mainHeadSha: MAIN_SHA,
    mode: "deploy",
    mergedPull: MERGED_PULL,
    isTreeMatch: true,
    redChecks: [],
    ...overrides,
  };
}

function checkRun(name, { id = 1, conclusion = "success", status = "completed", app } = {}) {
  return { id, name, status, conclusion, app: { slug: app ?? "github-actions" } };
}

function allGreen() {
  return REQUIRED_CHECKS.map((name, index) => checkRun(name, { id: index + 1 }));
}

describe("decideDeployGate", () => {
  it("refuses a non-main ref", () => {
    assert.deepEqual(decideDeployGate(gateInput({ ref: "refs/heads/x" })), {
      refusal: "not main: refs/heads/x",
    });
  });

  it("a rollback dispatch skips the stale check", () => {
    const outcome = decideDeployGate(
      gateInput({ mode: "rollback", sha: OLD_SHA, mergedPull: undefined }),
    );
    assert.equal(outcome.decision, "rollback");
  });

  it("a sha behind main HEAD is stale", () => {
    const outcome = decideDeployGate(gateInput({ sha: OLD_SHA }));
    assert.equal(outcome.decision, "stale");
    assert.equal(
      outcome.reason,
      "sha 0f1e2d3 is no longer main HEAD (a1b2c3d) — nothing to deploy",
    );
  });

  it('a sha from no merged PR verifies first, naming "tree not tested"', () => {
    const outcome = decideDeployGate(gateInput({ mergedPull: undefined, isTreeMatch: undefined }));
    assert.equal(outcome.decision, "verify-first");
    assert.equal(outcome.reason, "tree not tested: a1b2c3d came from no merged PR");
  });

  it("a tree that differs from the PR head verifies first", () => {
    const outcome = decideDeployGate(gateInput({ isTreeMatch: false }));
    assert.equal(outcome.decision, "verify-first");
    assert.equal(outcome.reason, "tree not tested: a1b2c3d differs from PR #42 head 9988776");
  });

  it("red or missing required checks on the PR head verify first, listing each", () => {
    const outcome = decideDeployGate(
      gateInput({ redChecks: ["e2e: completed/failure", "pr-title: missing"] }),
    );
    assert.equal(outcome.decision, "verify-first");
    assert.equal(
      outcome.reason,
      "checks red on PR #42 head 9988776: e2e: completed/failure, pr-title: missing",
    );
  });

  it("a tested tree with all checks green deploys", () => {
    assert.deepEqual(decideDeployGate(gateInput()), {
      decision: "deploy",
      reason: "tested tree: PR #42 head 9988776, all required checks green",
    });
  });
});

describe("findRedRequiredChecks", () => {
  it("all required checks green is nothing red", () => {
    assert.deepEqual(findRedRequiredChecks(allGreen(), REQUIRED_CHECKS), []);
  });

  it("only the latest run per name counts", () => {
    const runs = [checkRun("e2e", { id: 1, conclusion: "failure" }), checkRun("e2e", { id: 2 })];
    assert.deepEqual(findRedRequiredChecks(runs, ["e2e"]), []);
    const reversed = [
      checkRun("e2e", { id: 2, conclusion: "failure" }),
      checkRun("e2e", { id: 1 }),
    ];
    assert.deepEqual(findRedRequiredChecks(reversed, ["e2e"]), ["e2e: completed/failure"]);
  });

  it("a third-party app's same-name check does not count", () => {
    const runs = [checkRun("e2e", { id: 9, app: "other" })];
    assert.deepEqual(findRedRequiredChecks(runs, ["e2e"]), ["e2e: missing"]);
  });

  it("skipped is red", () => {
    const runs = [checkRun("unit-server", { conclusion: "skipped" })];
    assert.deepEqual(findRedRequiredChecks(runs, ["unit-server"]), [
      "unit-server: completed/skipped",
    ]);
  });

  it("an unfinished run is red", () => {
    const runs = [checkRun("static", { status: "in_progress", conclusion: null })];
    assert.deepEqual(findRedRequiredChecks(runs, ["static"]), ["static: in_progress/pending"]);
  });

  it('a missing check is named "missing"', () => {
    const runs = allGreen().filter((run) => run.name !== "pr-title");
    assert.deepEqual(findRedRequiredChecks(runs, REQUIRED_CHECKS), ["pr-title: missing"]);
  });
});
