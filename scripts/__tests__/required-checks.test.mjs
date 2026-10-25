import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { DEPLOY_JOBS } from "../lib/check-runs.mjs";
import { GITHUB_ACTIONS_APP_ID, REQUIRED_CHECKS } from "../lib/required-checks.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PR_WORKFLOWS = ["verify.yml", "e2e.yml", "pr-title.yml"];
const JOB_LINE = /^ {2}([\w-]+):\s*$/;
const JOB_KEY_LINE = /^ {4}(name|needs|if):\s*(.*)$/;

function readRepoFile(relativePath) {
  return readFileSync(path.join(REPO_ROOT, relativePath), "utf8").replace(/\r\n/g, "\n");
}

function readJobBlock(lines) {
  const keys = {};
  for (const line of lines) {
    const match = JOB_KEY_LINE.exec(line);
    if (match) keys[match[1]] = match[2].trim();
  }
  return keys;
}

function splitJobs(jobLines) {
  const jobs = [];
  for (const line of jobLines) {
    const match = JOB_LINE.exec(line);
    if (match) jobs.push({ id: match[1], lines: [] });
    else if (/^\S/.test(line)) break;
    else jobs.at(-1)?.lines.push(line);
  }
  return jobs;
}

function readWorkflow(fileName) {
  const lines = readRepoFile(`.github/workflows/${fileName}`).split("\n");
  const jobsStart = lines.indexOf("jobs:");
  const afterOn = lines.slice(lines.indexOf("on:") + 1);
  const onLines = afterOn.slice(
    0,
    afterOn.findIndex((line) => /^\S/.test(line)),
  );
  const triggers = onLines.flatMap((line) => /^ {2}([\w-]+):/.exec(line)?.[1] ?? []);
  const jobs = splitJobs(lines.slice(jobsStart + 1)).map(({ id, lines: jobBody }) => {
    const keys = readJobBlock(jobBody);
    return { id, checkName: keys.name ?? id, needs: keys.needs, condition: keys.if };
  });
  return { fileName, triggers, jobs };
}

function findPullRequestFilters(fileName) {
  const lines = readRepoFile(`.github/workflows/${fileName}`).split("\n");
  const start = lines.indexOf("  pull_request:");
  const filters = [];
  for (const line of lines.slice(start + 1)) {
    if (!/^ {4}/.test(line)) break;
    const filter = /^ {4}(paths|paths-ignore|branches|branches-ignore):/.exec(line)?.[1];
    if (filter) filters.push(filter);
  }
  return filters;
}

function readDeploySteps(jobId) {
  const lines = readRepoFile(".github/workflows/deploy.yml").split("\n");
  const job = splitJobs(lines.slice(lines.indexOf("jobs:") + 1)).find(({ id }) => id === jobId);
  const steps = [];
  for (const line of job.lines) {
    if (/^ {6}- /.test(line)) steps.push({});
    const key = /^ {6}[- ] (name|id|if): (.*)$/.exec(line);
    if (key && steps.length > 0) steps.at(-1)[key[1] === "if" ? "condition" : key[1]] = key[2];
  }
  return steps;
}

function readRulesetChecks() {
  const ruleset = JSON.parse(readRepoFile("infra/github/main-ruleset.json"));
  return ruleset.rules.find((rule) => rule.type === "required_status_checks").parameters
    .required_status_checks;
}

function findRequiredJob(name) {
  for (const fileName of PR_WORKFLOWS) {
    const workflow = readWorkflow(fileName);
    const job = workflow.jobs.find((candidate) => candidate.checkName === name);
    if (job) return { workflow, job };
  }
  return undefined;
}

describe("required checks", () => {
  it("the ruleset requires exactly REQUIRED_CHECKS, each from the Actions app", () => {
    const checks = readRulesetChecks();
    assert.deepEqual(checks.map((check) => check.context).sort(), [...REQUIRED_CHECKS].sort());
    for (const check of checks) {
      assert.equal(check.integration_id, GITHUB_ACTIONS_APP_ID, check.context);
    }
  });

  it("each required check is a pull_request job in verify, e2e or pr-title", () => {
    for (const name of REQUIRED_CHECKS) {
      const found = findRequiredJob(name);
      assert.ok(found, `no job reports "${name}"`);
      assert.equal(found.job.id, name, `${name} is the job id, not just its display name`);
      assert.ok(found.workflow.triggers.includes("pull_request"), `${found.workflow.fileName}`);
    }
  });

  it("no PR workflow filters pull_request by paths or branches, which would leave a check pending", () => {
    for (const fileName of PR_WORKFLOWS) {
      assert.deepEqual(findPullRequestFilters(fileName), [], fileName);
    }
  });

  it("each required job can never be skipped", () => {
    for (const name of REQUIRED_CHECKS) {
      const { job } = findRequiredJob(name);
      const isSelfReporting = job.needs === undefined && job.condition === undefined;
      const isAlwaysRun = job.condition === "always()";
      assert.ok(isSelfReporting || isAlwaysRun, `${name}: needs ${job.needs}, if ${job.condition}`);
    }
  });

  it("credentialed deploy jobs re-check main HEAD; rollback relies on its revert judges instead", () => {
    const lines = readRepoFile(".github/workflows/deploy.yml").split("\n");
    const jobs = splitJobs(lines.slice(lines.indexOf("jobs:") + 1));
    const bodyOf = (id) => jobs.find((job) => job.id === id).lines.join("\n");
    for (const id of ["server", "hosting", "promote", "restore"]) {
      assert.match(bodyOf(id), /deploy-gate\.mjs --check-head/, id);
    }
    // A merge mid-deploy must not strand a half-done promote; the judges only undo this run's own changes.
    assert.doesNotMatch(bodyOf("rollback"), /--check-head/);
    assert.match(bodyOf("rollback"), /deploy-gate\.mjs --check-hosting-revert/);
    assert.match(bodyOf("rollback"), /deploy-gate\.mjs --check-traffic-revert/);
  });

  it("rollback reverts traffic after a promote only once hosting is on the previous version (I4)", () => {
    const steps = readDeploySteps("rollback");
    const hostingIndex = steps.findIndex((step) => step.id === "hosting_revert");
    const trafficStep = steps.find(
      (step) => step.name === "Route server traffic back to the recorded revision",
    );
    assert.ok(hostingIndex >= 0, "the hosting revert step has id hosting_revert");
    assert.ok(steps.indexOf(trafficStep) > hostingIndex, "hosting reverts before traffic");
    assert.match(trafficStep.condition, /steps\.traffic_ours\.outputs\.should_revert == 'true'/);
    assert.match(
      trafficStep.condition,
      /\(needs\.promote\.outputs\.promoted != 'true' \|\| steps\.hosting_revert\.outcome == 'success' \|\| steps\.hosting_ours\.outputs\.hosting_is_previous == 'true'\)/,
    );
  });

  it("promote records the live hosting version straight after the clone, before the meta assert", () => {
    const names = readDeploySteps("promote").map((step) => step.name);
    const clone = names.indexOf("Clone the smoked channel to live");
    const record = names.indexOf("Record the live hosting version");
    const assertMeta = names.indexOf("Assert the live build sha");
    assert.ok(clone >= 0 && record === clone + 1 && assertMeta > record, names.join(" | "));
  });

  it("a deploy job below a skippable job carries a status function, or it inherits the skip", () => {
    const jobs = readWorkflow("deploy.yml").jobs;
    const byId = new Map(jobs.map((job) => [job.id, job]));
    const parseNeeds = (needs) =>
      (needs ?? "")
        .replace(/[[\]]/g, "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
    const hasSkippableAncestor = (job, seen = new Set()) =>
      parseNeeds(job.needs).some((id) => {
        if (seen.has(id)) return false;
        seen.add(id);
        const ancestor = byId.get(id);
        return ancestor.condition !== undefined || hasSkippableAncestor(ancestor, seen);
      });
    const STATUS_FUNCTION = /\b(cancelled|always|failure|success)\(\)/;
    const unguarded = jobs
      .filter((job) => hasSkippableAncestor(job))
      .filter((job) => !STATUS_FUNCTION.test(job.condition ?? ""))
      .map((job) => job.id);
    assert.deepEqual(unguarded, []);
  });

  it("promote, and so record, run only when the plan deploys something (I5: tag = live)", () => {
    const promote = readWorkflow("deploy.yml").jobs.find((job) => job.id === "promote");
    assert.match(
      promote.condition,
      /\(needs\.plan\.outputs\.server == 'true' \|\| needs\.plan\.outputs\.hosting == 'true'\)/,
    );
  });

  it("deploy.yml deploys every push to main and keeps the manual dispatch", () => {
    const { triggers } = readWorkflow("deploy.yml");
    assert.deepEqual([...triggers].sort(), ["push", "workflow_dispatch"]);
    const workflowText = readRepoFile(".github/workflows/deploy.yml");
    assert.match(workflowText, /^ {2}push:\n {4}branches: \[main\]$/m);
  });

  it("no deploy job shares a name with a required check", () => {
    const deployJobIds = readWorkflow("deploy.yml").jobs.map((job) => job.id);
    assert.deepEqual(
      deployJobIds.filter((id) => REQUIRED_CHECKS.includes(id)),
      [],
    );
    assert.deepEqual(
      DEPLOY_JOBS.filter((job) => REQUIRED_CHECKS.includes(job)),
      [],
    );
    for (const id of deployJobIds) assert.ok(DEPLOY_JOBS.includes(id), `${id} not in DEPLOY_JOBS`);
  });
});
