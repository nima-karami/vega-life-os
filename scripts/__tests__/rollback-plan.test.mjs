import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDeployManifest, buildReleaseNotes } from "../lib/release-notes.mjs";
import { planRollback } from "../lib/rollback-plan.mjs";

const SKIPPED = { status: "skipped", reason: "none of 2 files changed since 56f69c3 affect it" };

function release(tagName, { server = SKIPPED, hosting = SKIPPED } = {}) {
  return {
    tagName,
    body: buildReleaseNotes({
      previousTag: "v2026.9.1",
      commits: [{ sha: "abc1234", subject: "fix: something small" }],
      manifest: buildDeployManifest({ sha: "abc1234", server, hosting }),
    }),
  };
}

function shippedServer(revision) {
  return { status: "shipped", revision, image: "repo@sha256:01" };
}

function shippedHosting(hostingVersion) {
  return { status: "shipped", hostingVersion };
}

const HISTORY = [
  release("v2026.11.3", { server: shippedServer("r3"), hosting: shippedHosting("h3") }),
  release("v2026.11.2", { hosting: shippedHosting("h2") }),
  release("v2026.11.1", { server: shippedServer("r1"), hosting: shippedHosting("h1") }),
];

describe("planRollback", () => {
  it("rolls hosting back first, then the server, to the newest older release that shipped each", () => {
    assert.deepEqual(planRollback(HISTORY), {
      fromVersion: "v2026.11.3",
      steps: [
        { target: "hosting", toVersion: "v2026.11.2", id: "h2" },
        { target: "server", toVersion: "v2026.11.1", id: "r1" },
      ],
    });
  });

  it("a target the newest release did not ship is left alone", () => {
    const history = [release("v2026.11.4", { hosting: shippedHosting("h4") }), ...HISTORY];
    assert.deepEqual(planRollback(history), {
      fromVersion: "v2026.11.4",
      steps: [{ target: "hosting", toVersion: "v2026.11.3", id: "h3" }],
    });
  });

  it("refuses by name when the target release recorded no id", () => {
    const history = [
      release("v2026.10.6", { hosting: shippedHosting("h6") }),
      release("v2026.10.5", { server: shippedServer("r5"), hosting: { status: "shipped" } }),
    ];
    assert.deepEqual(planRollback(history), {
      refusal:
        "v2026.10.5 recorded no hosting version — roll back by hand (docs/release-process.md §6)",
    });
  });

  it("refuses when no older release shipped the target", () => {
    const history = [
      release("v2026.11.2", { server: shippedServer("r2") }),
      release("v2026.11.1", { hosting: shippedHosting("h1") }),
    ];
    assert.deepEqual(planRollback(history), {
      refusal: "no release before v2026.11.2 shipped server",
    });
  });

  it("refuses with no releases", () => {
    assert.deepEqual(planRollback([]), { refusal: "no versioned releases" });
  });

  it("ignores tags that are not versions", () => {
    const history = [{ tagName: "archive/paper-wip", body: "" }, ...HISTORY];
    assert.equal(planRollback(history).fromVersion, "v2026.11.3");
  });

  it("input order does not matter", () => {
    const shuffled = [HISTORY[1], HISTORY[2], HISTORY[0]];
    assert.deepEqual(planRollback(shuffled), planRollback(HISTORY));
  });
});
