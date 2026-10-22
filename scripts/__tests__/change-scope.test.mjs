import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyChangedFile,
  classifyCiScope,
  isCommitSha,
  planTarget,
} from "../lib/change-scope.mjs";

const LIVE_SHA = "56f69c3";

function planBoth(changedFiles, only) {
  return ["server", "hosting"].map((target) =>
    planTarget({ target, liveSha: LIVE_SHA, changedFiles, only }),
  );
}

function deployedTargets(plans) {
  return plans.filter((plan) => plan.shouldDeploy).map((plan) => plan.target);
}

describe("classifyChangedFile", () => {
  it("routes web, server and shared code to their targets", () => {
    assert.deepEqual(classifyChangedFile("apps/web/src/app/App.tsx").targets, ["hosting"]);
    assert.deepEqual(classifyChangedFile("apps/server/src/app.ts").targets, ["server"]);
    assert.deepEqual(classifyChangedFile("packages/shared/src/schema-hash.ts").targets, [
      "server",
      "hosting",
    ]);
  });

  it("ships both for the dependency manifests the server image installs", () => {
    for (const filePath of ["package.json", "package-lock.json", "apps/web/package.json"]) {
      assert.deepEqual(classifyChangedFile(filePath).targets, ["server", "hosting"], filePath);
    }
  });

  it("routes deploy config to the target it configures", () => {
    assert.deepEqual(classifyChangedFile("cloudbuild.server.yaml").targets, ["server"]);
    assert.deepEqual(classifyChangedFile("firebase.json").targets, ["hosting"]);
    assert.deepEqual(classifyChangedFile(".firebaserc").targets, ["hosting"]);
  });

  it("ships nothing for docs, markdown and agent config", () => {
    for (const filePath of ["docs/release-process.md", "README.md", ".claude/settings.json"]) {
      assert.deepEqual(classifyChangedFile(filePath).targets, [], filePath);
    }
  });

  it("ships nothing for repo tooling that neither artifact contains", () => {
    for (const filePath of [
      "scripts/release.mjs",
      ".github/workflows/verify.yml",
      ".husky/pre-push",
      "biome.json",
      "knip.json",
      "tsconfig.json",
      "infra/setup-ci-release.sh",
    ]) {
      assert.deepEqual(classifyChangedFile(filePath).targets, [], filePath);
    }
  });

  it("ships both for a path it does not recognise", () => {
    const classification = classifyChangedFile("some/new/thing.ts");
    assert.deepEqual(classification.targets, ["server", "hosting"]);
    assert.equal(classification.rule, "unknown");
  });

  it("does not mistake a lookalike prefix for a slice", () => {
    assert.equal(classifyChangedFile("apps/webby/x.ts").rule, "unknown");
    assert.equal(classifyChangedFile("docsy/x.ts").rule, "unknown");
  });
});

describe("planTarget — the four release shapes", () => {
  it("web-only change deploys hosting only", () => {
    assert.deepEqual(deployedTargets(planBoth(["apps/web/src/main.tsx"])), ["hosting"]);
  });

  it("server-only change deploys the server only", () => {
    assert.deepEqual(deployedTargets(planBoth(["apps/server/src/app.ts"])), ["server"]);
  });

  it("shared change deploys both", () => {
    assert.deepEqual(deployedTargets(planBoth(["packages/shared/src/entities/base.ts"])), [
      "server",
      "hosting",
    ]);
  });

  it("docs-only change deploys nothing", () => {
    assert.deepEqual(deployedTargets(planBoth(["docs/release-process.md", "CLAUDE.md"])), []);
  });
});

describe("planTarget — fail safe and overrides", () => {
  it("counts only the files that affect the target", () => {
    const plan = planTarget({
      target: "hosting",
      liveSha: LIVE_SHA,
      changedFiles: ["apps/web/a.ts", "apps/web/b.ts", "docs/x.md", "apps/server/c.ts"],
    });
    assert.equal(plan.shouldDeploy, true);
    assert.deepEqual(plan.relevantFiles, ["apps/web/a.ts", "apps/web/b.ts"]);
    assert.equal(plan.changedFileCount, 4);
  });

  it("skips a target that is already live at HEAD", () => {
    const plan = planTarget({ target: "server", liveSha: LIVE_SHA, changedFiles: [] });
    assert.equal(plan.shouldDeploy, false);
    assert.match(plan.reason, /already live/);
  });

  it("deploys when the live sha is unknown, unreachable or a dev build", () => {
    for (const liveSha of [undefined, "", "dev", "(not reported)"]) {
      const plan = planTarget({ target: "server", liveSha, changedFiles: [] });
      assert.equal(plan.shouldDeploy, true, String(liveSha));
      assert.match(plan.reason, /unknown/);
    }
  });

  it("deploys when the live sha is not in git history", () => {
    const plan = planTarget({ target: "hosting", liveSha: "abcdef1", changedFiles: undefined });
    assert.equal(plan.shouldDeploy, true);
    assert.match(plan.reason, /not in git history/);
  });

  it("--only forces the named targets and skips the rest", () => {
    assert.deepEqual(deployedTargets(planBoth(["docs/x.md"], "both")), ["server", "hosting"]);
    assert.deepEqual(deployedTargets(planBoth(["apps/server/a.ts"], "hosting")), ["hosting"]);
    assert.deepEqual(deployedTargets(planBoth(["apps/web/a.ts"], "server")), ["server"]);
  });
});

describe("isCommitSha", () => {
  it("accepts short and full hex shas only", () => {
    assert.equal(isCommitSha("56f69c3"), true);
    assert.equal(isCommitSha("a".repeat(40)), true);
    assert.equal(isCommitSha("dev"), false);
    assert.equal(isCommitSha("56f69"), false);
    assert.equal(isCommitSha(undefined), false);
  });
});

describe("classifyCiScope", () => {
  it("docs-only change is docs scope", () => {
    assert.equal(classifyCiScope(["docs/a.md", "README.md", ".claude/x.json"]), "docs");
  });

  it("web plus docs is web scope", () => {
    assert.equal(classifyCiScope(["apps/web/src/a.tsx", "docs/a.md"]), "web");
  });

  it("anything outside web and docs runs the full gate", () => {
    assert.equal(classifyCiScope(["apps/web/src/a.tsx", "packages/shared/src/b.ts"]), "full");
    assert.equal(classifyCiScope(["apps/server/src/a.ts"]), "full");
    assert.equal(classifyCiScope([".github/workflows/verify.yml"]), "full");
    assert.equal(classifyCiScope(["package-lock.json"]), "full");
    assert.equal(classifyCiScope(["scripts/release.mjs"]), "full");
  });

  it("runs the full gate when the change list is empty or unknown", () => {
    assert.equal(classifyCiScope([]), "full");
    assert.equal(classifyCiScope(undefined), "full");
  });
});
