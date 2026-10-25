#!/usr/bin/env node
// Prints the mode: rollback plan (one release back, hosting first) as JSON, from the Releases' Deploy blocks.
import { fetchVersionedReleases } from "./lib/github-releases.mjs";
import { REPO_ROOT } from "./lib/live-endpoints.mjs";
import { planRollback } from "./lib/rollback-plan.mjs";

const plan = planRollback(fetchVersionedReleases({ cwd: REPO_ROOT, limit: 30 }));

if (plan.refusal) {
  console.error(`rollback-plan: REFUSED — ${plan.refusal}`);
  process.exitCode = 1;
} else {
  console.log(JSON.stringify(plan, null, 2));
}
