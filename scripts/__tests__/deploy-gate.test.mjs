import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decideDeployGate,
  findRedRequiredChecks,
  judgeHostingRevert,
  judgeMainHead,
  judgeTrafficRevert,
} from "../lib/deploy-gate.mjs";
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

describe("judgeMainHead", () => {
  const current = { ref: "refs/heads/main", sha: MAIN_SHA, mainHeadSha: MAIN_SHA, mode: "deploy" };

  it("a job of the current main HEAD may touch production", () => {
    assert.equal(judgeMainHead(current).refusal, undefined);
  });

  it("a re-run after main moved refuses before touching production", () => {
    assert.deepEqual(judgeMainHead({ ...current, mainHeadSha: OLD_SHA }), {
      refusal:
        "sha a1b2c3d is no longer main HEAD (0f1e2d3) — a re-run of an old deploy must not touch production",
    });
  });

  it("a rollback dispatch keeps its own semantics", () => {
    assert.equal(
      judgeMainHead({ ...current, mode: "rollback", mainHeadSha: OLD_SHA }).refusal,
      undefined,
    );
  });

  it("a non-main ref refuses, even for a rollback", () => {
    assert.deepEqual(judgeMainHead({ ...current, ref: "refs/heads/x", mode: "rollback" }), {
      refusal: "not main: refs/heads/x",
    });
  });
});

describe("judgeHostingRevert", () => {
  const ours = { promotedVersion: "h-new", shortSha: "a1b2c3d" };

  it("reverts when live is still the version this run promoted", () => {
    const outcome = judgeHostingRevert({ ...ours, liveVersion: "h-new", liveBuildSha: "a1b2c3d" });
    assert.equal(outcome.shouldRevert, true);
  });

  it("reverts when live serves this run's build though promote recorded no version", () => {
    const outcome = judgeHostingRevert({
      shortSha: "a1b2c3d",
      promotedVersion: "",
      liveVersion: "h-new",
      liveBuildSha: "a1b2c3d",
    });
    assert.equal(outcome.shouldRevert, true);
  });

  it("leaves a newer release alone", () => {
    const outcome = judgeHostingRevert({
      ...ours,
      liveVersion: "h-later",
      liveBuildSha: "9988776",
    });
    assert.deepEqual(outcome, {
      shouldRevert: false,
      isUnreadable: false,
      isHostingPrevious: false,
      reason:
        "live hosting is h-later (build 9988776), not this run's h-new / a1b2c3d — leaving it",
    });
  });

  it("live still on the previous version (the clone never landed) is left alone", () => {
    const outcome = judgeHostingRevert({
      shortSha: "a1b2c3d",
      promotedVersion: "",
      previousVersion: "h-old",
      liveVersion: "h-old",
      liveBuildSha: "",
    });
    assert.equal(outcome.shouldRevert, false);
    assert.equal(outcome.isUnreadable, false);
    assert.equal(outcome.isHostingPrevious, true);
  });

  it("only a live previous version counts as hosting already back", () => {
    const cases = [
      { ...ours, liveVersion: "h-new", liveBuildSha: "a1b2c3d", previousVersion: "h-old" },
      { ...ours, liveVersion: "h-later", liveBuildSha: "9988776", previousVersion: "h-old" },
      { ...ours, liveVersion: "", liveBuildSha: "", previousVersion: "h-old" },
    ];
    for (const input of cases) {
      assert.equal(judgeHostingRevert(input).isHostingPrevious, false, JSON.stringify(input));
    }
  });

  it("an unreadable live state is judged unreadable, not someone else's", () => {
    const outcome = judgeHostingRevert({ ...ours, liveVersion: "", liveBuildSha: "" });
    assert.equal(outcome.shouldRevert, false);
    assert.equal(outcome.isUnreadable, true);
  });

  it("promoted, version unknown, build unreadable is unreadable", () => {
    const outcome = judgeHostingRevert({
      shortSha: "a1b2c3d",
      promotedVersion: "",
      previousVersion: "h-old",
      liveVersion: "h-mystery",
      liveBuildSha: "",
    });
    assert.equal(outcome.shouldRevert, false);
    assert.equal(outcome.isUnreadable, true);
    assert.match(outcome.reason, /docs\/release-process\.md §6/);
  });
});

describe("judgeTrafficRevert", () => {
  it("reverts when this run's revision serves all traffic", () => {
    const outcome = judgeTrafficRevert({
      servingTraffic: "vega-server-00041-new=100",
      runRevision: "vega-server-00041-new",
    });
    assert.equal(outcome.shouldRevert, true);
  });

  it("leaves another revision's traffic alone", () => {
    assert.deepEqual(
      judgeTrafficRevert({
        servingTraffic: "vega-server-00042-later=100",
        runRevision: "vega-server-00041-new",
      }),
      {
        shouldRevert: false,
        isUnreadable: false,
        reason:
          "serving vega-server-00042-later=100, not this run's vega-server-00041-new — leaving traffic",
      },
    );
  });

  it("a split that includes another revision is not ours to undo", () => {
    const outcome = judgeTrafficRevert({
      servingTraffic: "vega-server-00041-new=50,vega-server-00040-old=50",
      runRevision: "vega-server-00041-new",
    });
    assert.equal(outcome.shouldRevert, false);
  });

  it("no recorded revision or unreadable traffic is unreadable, and reverts nothing", () => {
    for (const input of [
      { servingTraffic: "", runRevision: "r" },
      { servingTraffic: "r=100", runRevision: "" },
    ]) {
      const outcome = judgeTrafficRevert(input);
      assert.equal(outcome.shouldRevert, false, JSON.stringify(input));
      assert.equal(outcome.isUnreadable, true, JSON.stringify(input));
    }
  });
});
