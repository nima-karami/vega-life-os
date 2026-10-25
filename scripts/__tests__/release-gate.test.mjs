import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  chooseLocalGate,
  describeHeadDrift,
  describePlanDrift,
  findActiveCiDeploy,
  judgeCiDeployCheck,
} from "../lib/release-gate.mjs";

const SHA_X = "1111111aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SHA_Y = "2222222bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

describe("chooseLocalGate", () => {
  it("skips the gate when this release already gated the same sha", () => {
    assert.deepEqual(chooseLocalGate({ releaseSha: SHA_X, gatedSha: SHA_X, isBreakGlass: false }), {
      scripts: [],
    });
  });

  it("refuses when the release gated another sha", () => {
    const choice = chooseLocalGate({ releaseSha: SHA_Y, gatedSha: SHA_X, isBreakGlass: true });
    assert.match(choice.refusal, /2222222.*1111111/);
    assert.equal(choice.scripts, undefined);
  });

  it("refuses the laptop path without break-glass", () => {
    const choice = chooseLocalGate({ releaseSha: SHA_X, isBreakGlass: false });
    assert.ok(choice.refusal.includes("npm run release -- --break-glass"), choice.refusal);
    assert.equal(choice.scripts, undefined);
  });

  it("names the normal CI path in both phases, and the standalone break-glass spellings", () => {
    const { refusal } = chooseLocalGate({ releaseSha: SHA_X, isBreakGlass: false });
    assert.doesNotMatch(refusal, /CI deploys every merge/);
    assert.match(refusal, /deploy\.yml dispatch/);
    assert.match(refusal, /merge to main once auto-deploy is on/);
    assert.match(refusal, /RELEASE_BREAK_GLASS=1 npm run deploy/);
    assert.match(refusal, /npm run deploy:server -- --break-glass/);
  });

  it("break-glass runs verify and the bundle smoke whatever CI says", () => {
    assert.deepEqual(chooseLocalGate({ releaseSha: SHA_X, isBreakGlass: true }), {
      scripts: ["verify", "smoke:server-bundle"],
    });
  });
});

describe("judgeCiDeployCheck", () => {
  it("a running CI deploy refuses with its url", () => {
    const url = "https://github.com/o/r/actions/runs/7";
    assert.deepEqual(judgeCiDeployCheck({ activeRunUrl: url }), {
      refusal: `a CI deploy is running: ${url}`,
    });
  });

  it("an unreadable run list warns and proceeds", () => {
    const outcome = judgeCiDeployCheck({ readError: "gh: HTTP 503" });
    assert.equal(outcome.refusal, undefined);
    assert.match(
      outcome.warning,
      /could not confirm that no CI deploy is running \(gh: HTTP 503\)/,
    );
  });

  it("quiet when none runs", () => {
    assert.deepEqual(judgeCiDeployCheck({}), {});
  });
});

describe("findActiveCiDeploy", () => {
  const STATUSES = ["queued", "in_progress"];
  const RUN_URL = "https://github.com/o/r/actions/runs/9";

  function runLister(byWorkflow) {
    return (workflow, status) => {
      const outcome = byWorkflow[workflow];
      if (outcome instanceof Error) throw outcome;
      return outcome?.[status] ?? [];
    };
  }

  it("a read failure on one workflow still checks the next", () => {
    const listActiveRuns = runLister({
      "deploy.yml": new Error("HTTP 404: workflow deploy.yml not found"),
      "release.yml": { in_progress: [{ url: RUN_URL }] },
    });
    assert.deepEqual(
      findActiveCiDeploy({
        workflows: ["deploy.yml", "release.yml"],
        statuses: STATUSES,
        listActiveRuns,
      }),
      { activeRunUrl: RUN_URL },
    );
  });

  it("reports the read failure when nothing readable is running", () => {
    const listActiveRuns = runLister({
      "deploy.yml": new Error("HTTP 404: workflow deploy.yml not found\nmore"),
      "release.yml": {},
    });
    assert.deepEqual(
      findActiveCiDeploy({
        workflows: ["deploy.yml", "release.yml"],
        statuses: STATUSES,
        listActiveRuns,
      }),
      { readError: "deploy.yml: HTTP 404: workflow deploy.yml not found" },
    );
  });

  it("is empty when every workflow reads and none runs", () => {
    assert.deepEqual(
      findActiveCiDeploy({
        workflows: ["deploy.yml", "release.yml"],
        statuses: STATUSES,
        listActiveRuns: runLister({}),
      }),
      {},
    );
  });
});

describe("describeHeadDrift", () => {
  it("is quiet while HEAD is the expected sha", () => {
    assert.equal(describeHeadDrift(SHA_X, SHA_X), undefined);
  });

  it("names both shas when HEAD moved", () => {
    assert.match(describeHeadDrift(SHA_X, SHA_Y), /1111111 to 2222222/);
  });
});

describe("describePlanDrift", () => {
  function plan(overrides = {}) {
    return {
      headFullSha: SHA_X,
      headSha: "1111111",
      version: "v2026.10.5",
      record: true,
      targets: [
        { target: "server", shouldDeploy: true, liveSha: "aaaaaaa", reason: "3 files" },
        { target: "hosting", shouldDeploy: false, liveSha: "1111111", reason: "live" },
      ],
      ...overrides,
    };
  }

  it("is quiet for the same plan, whatever the wording of its reasons", () => {
    const reworded = plan();
    reworded.targets[0].reason = "something else";
    assert.equal(describePlanDrift(plan(), reworded), undefined);
  });

  it("flags a version a CI release claimed meanwhile", () => {
    assert.ok(describePlanDrift(plan(), plan({ version: "v2026.10.6" })));
    assert.ok(describePlanDrift(plan(), plan({ record: false })));
  });

  it("flags a moved HEAD or a changed live sha", () => {
    assert.ok(describePlanDrift(plan(), plan({ headFullSha: SHA_Y })));
    const redeployed = plan();
    redeployed.targets[0] = { ...redeployed.targets[0], liveSha: "1111111", shouldDeploy: false };
    assert.ok(describePlanDrift(plan(), redeployed));
  });
});
