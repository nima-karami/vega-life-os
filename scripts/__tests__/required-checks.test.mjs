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
  const onLines = lines.slice(lines.indexOf("on:") + 1, jobsStart);
  const triggers = onLines.flatMap((line) => /^ {2}([\w-]+):/.exec(line)?.[1] ?? []);
  const jobs = splitJobs(lines.slice(jobsStart + 1)).map(({ id, lines: jobBody }) => {
    const keys = readJobBlock(jobBody);
    return { id, checkName: keys.name ?? id, needs: keys.needs, condition: keys.if };
  });
  return { fileName, triggers, jobs };
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

  it("each required job can never be skipped", () => {
    for (const name of REQUIRED_CHECKS) {
      const { job } = findRequiredJob(name);
      const isSelfReporting = job.needs === undefined && job.condition === undefined;
      const isAlwaysRun = job.condition === "always()";
      assert.ok(isSelfReporting || isAlwaysRun, `${name}: needs ${job.needs}, if ${job.condition}`);
    }
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
