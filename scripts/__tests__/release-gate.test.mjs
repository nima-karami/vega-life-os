import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { chooseLocalGate, describeHeadDrift, describePlanDrift } from "../lib/release-gate.mjs";

const SHA_X = "1111111aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SHA_Y = "2222222bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

describe("chooseLocalGate", () => {
  it("skips the gate when this release already gated the same sha", () => {
    assert.deepEqual(chooseLocalGate({ releaseSha: SHA_X, gatedSha: SHA_X, isCiGreen: true }), {
      scripts: [],
    });
  });

  it("refuses when the release gated another sha", () => {
    const choice = chooseLocalGate({ releaseSha: SHA_Y, gatedSha: SHA_X, isCiGreen: true });
    assert.match(choice.refusal, /2222222.*1111111/);
    assert.equal(choice.scripts, undefined);
  });

  it("runs e2e when CI is green", () => {
    assert.deepEqual(chooseLocalGate({ releaseSha: SHA_X, isCiGreen: true }), {
      scripts: ["e2e"],
    });
  });

  it("runs the whole gate and the bundle smoke when CI is red", () => {
    assert.deepEqual(chooseLocalGate({ releaseSha: SHA_X, isCiGreen: false }), {
      scripts: ["verify", "smoke:server-bundle"],
    });
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
