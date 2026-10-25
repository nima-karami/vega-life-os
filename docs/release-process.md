# VEGA Life OS — Release Process

How a change travels from a branch to vega-life-os.web.app and the `vega-server` Cloud Run
service. Code style (naming, comments) lives in **[`style-guide.md`](style-guide.md)**;
this doc is the workflow.

In one line: **branch → PR → seven required checks → squash auto-merge → `deploy.yml` stages,
smokes, promotes and records the merge.** `main` is protected; nothing reaches it any other
way.

---

## 1. Branch

Work on a short-lived branch off `origin/main`, named `feat|fix|chore|ci|docs/<slug>` (agent
lanes may use their own prefix). One reviewable change per PR.

## 2. Commit and PR title — Conventional Commits

Lowercase, imperative, no trailing period:

```
type(scope): subject

optional body — the why, wrapped ~72 cols

Co-Authored-By: Claude <model name> <noreply@anthropic.com>
```

The trailer names **the model that actually did the work** — update it when the model
changes rather than copying the previous commit's name.

- **type:** `feat` · `fix` · `perf` · `refactor` · `test` · `docs` · `build` · `ci` ·
  `chore` · `revert`. The release notes group commits by these types (§5).
- **scope:** the feature slice touched (`calendar-sync`, `streaks`, `auth`). Multiple →
  comma-separate: `feat(streaks,journal): …`.
- **subject:** what changed and why it matters, tersely. Prefer
  `fix(calendar-sync): never unschedule a resolved task on a cancelled event`
  over `fix: bug`.
- **The PR title is what lands.** Squash merges use the PR title as the commit subject and
  the PR body as the commit body, so:
  - the title must be a Conventional subject; the `pr-title` check enforces it, and GitHub's
    `Revert "…"` passes;
  - the `Co-Authored-By` trailer goes at the end of the PR body.
- Before every commit run `git status` and confirm **only intended files** are staged.
  Scratch artifacts (screenshots, logs, scratch scripts) go to `%TEMP%\claude-scratch\`,
  never the repo.

## 3. The gate

`npm run verify` is the whole gate. It runs, in order:

```
format:check → lint → typecheck → deadcode → check:lockfile → check:suppressions → test
  → dupes → scan:secrets → audit:deps → e2e
```

Never `--no-verify`; never weaken a check to get through it (see `style-guide.md §1`).
Each layer runs a different slice of it:

| Where | Runs |
|---|---|
| **pre-commit** (husky) | `lint-staged` (Biome on staged files) + `gitleaks` on the staged diff |
| **pre-push** (husky) | `format:check`, `lint`, `typecheck` (~1 min; `tsc -b` is incremental) |
| **every PR** (seven required checks) | `static`: format, lint, typecheck, deadcode, dupes, lockfile platforms, suppressions, script tests · `unit-web` · `unit-shared` · `unit-server`: the server suite on the emulator + `smoke:server-bundle` · `security`: Semgrep, `npm audit --audit-level=high`, OSV, gitleaks · `e2e`: the full Playwright suite in 4 shards, PWA on shard 1 · `pr-title` |
| **push to `main`** | `verify.yml` again (scope narrowing and the break-glass guard read it), and `deploy.yml` (§5) |
| **deploy** | `/health` and schema checks on the staged revision, `@smoke` against the staged hosting channel, the live `vega-build` meta after promote |

e2e runs on every PR (user decision 2026-10-24, superseding the 2026-10-23 "e2e at release"
decision; the repo is public, so standard runners are free). `gh workflow run e2e.yml --ref
<branch>` runs it on demand.

### Every required check always reports

GitHub treats a *skipped* required check as passing, and a `paths:`-filtered workflow that
never starts leaves its check pending forever. So:

- Scope narrowing happens inside jobs, never through `paths:`/`branches:` filters on
  `pull_request`.
- A required job with no `needs:` and no `if:` cannot be skipped, so it reports itself
  (`static`, `unit-*`, `security`, `pr-title`).
- `e2e` is an `if: always()` aggregator over `e2e-scope` and the four `e2e-shard (N/4)` jobs.
  It fails if any of them failed or was cancelled. Skipped shards count as success only when
  the scope chose `docs`.
- `scripts/__tests__/required-checks.test.mjs` locks this: the ruleset's contexts, the job
  ids and `REQUIRED_CHECKS` must match, and no required job may be skippable.
- **Renaming or removing a required check** means updating `infra/github/main-ruleset.json`
  and `scripts/lib/required-checks.mjs` in the same PR, or every PR blocks.

### CI change scope

By explicit user decision (2026-10-22), CI skips work a change cannot affect.
`scripts/ci-scope.mjs` diffs the PR's base (or the push's `before` sha) against `HEAD`:

| Changed files | Scope | Skipped |
|---|---|---|
| only `docs/**`, `*.md`, `.claude/**` | `docs` | the server suite, `smoke:server-bundle`, the e2e shards |
| only those plus `apps/web/**` | `web` | the server suite, `smoke:server-bundle` |
| anything else | `full` | nothing |

A push narrows **only when its base commit's own verify run succeeded**, so a docs commit on
top of a red one is never green. No base, an all-zero base, an unknown sha, a dispatch or any
detection error → `full`. Diffs use `--no-renames`, so a file moved out of a slice still
counts for that slice.

**The risk, stated:** a web-only change ships without the server suite having run on it.
That is sound only while `apps/web/**` cannot change server behaviour. Anything shared
lives in `packages/shared/`, which forces `full`.

### Advisories and flakes

- **OSV blocks on High/Critical and warns below** (§14 Q1, owner decision 2026-10-24),
  matching `npm audit --audit-level=high`. `scripts/check-osv-severity.mjs` judges the JSON
  report: an ungradeable finding, or a vulnerability no group covers, blocks. A red advisory
  is fixed by a dependency PR, never by a bypass.
- **Flakes:** Playwright retries once on CI. A flake that recurs is a bug to fix, not noise.

## 4. PR and merge

The `main` ruleset (`infra/github/main-ruleset.json`):
- no direct push and no force-push or deletion;
- PRs only, squash only;
- the seven checks required, each pinned to the GitHub Actions app;
- strict: the branch must be up to date with `main`;
- 0 approvals;
- a repo-admin bypass for PR merges only, which the audit log records.

Repo settings: squash commit title = PR title, body = PR body; auto-merge on; head branches
deleted on merge; "update branch" on.

```bash
gh pr create --title "fix(boot): …" --body-file <body>   # body ends with the Co-Authored-By trailer
gh pr merge <n> --auto --squash                           # only when the change should ship
gh pr update-branch <n>                                   # when main moved and the PR is behind
```

- **Two PRs green at once:** the first merges, and the second goes behind, so it must update
  and re-run its checks. That is fine for 1–3 parallel lanes; beyond that, stack or
  serialise the PRs.
- **Forks and Dependabot** run every check without secrets. Forks never auto-merge.
  Dependabot titles are `ci(deps): …`.
- **Unfinished work** stays on its branch or a draft PR.
- **A shareable preview:** `npm run deploy:preview` (a 7-day Hosting channel), from the
  laptop.

## 5. Deploy: every merge to main

`.github/workflows/deploy.yml` runs on every push to `main` and on `workflow_dispatch`
(`mode`, `targets`, `dry_run`, `drill`). It sits in one concurrency group, `deploy`: one run
at a time, one pending, and a newer run replaces the pending one.

| Job | Does |
|---|---|
| `gate` | `scripts/deploy-gate.mjs`. Refuses a non-main ref. `mode: rollback` → `restore`. A sha that is no longer `main` HEAD → `stale` (nothing runs). A merge whose tree equals a PR head with all seven checks green → `deploy`. Anything else → `verify-first` |
| `fallback-verify`, `fallback-e2e` | Only on `verify-first`: `verify.yml` and `e2e.yml` with `force_full` on this sha. `plan` waits for both |
| `plan` | `node scripts/release.mjs --plan-json` against the live shas: which targets changed, the next `version`, `record` |
| `server` | Stage only. Docker build → push → record the serving traffic → `run deploy --no-traffic --tag c-<sha>` → the tag URL's `/health` must report the sha and `check-live-schema` must pass |
| `hosting` | Stage only, in parallel with `server`. Build with the `VITE_*` variables → record the live Hosting version → `hosting:channel:deploy c-<sha>` → the channel must serve `vega-build` = sha |
| `smoke` | `playwright.smoke.config.ts` (`@smoke` tests) against the channel URL. No credentials |
| `promote` | Server traffic `--to-latest` and drop the tag → service URL `/health` = sha → live schema check → `hosting:clone` channel → live → record the live hosting version → live `vega-build` = sha → delete the channel |
| `record` | When `plan.record` and promote succeeded: release notes (with the server revision and hosting version), annotated tag, GitHub Release |
| `rollback` | On failure or cancel after staging (below) |
| `restore` | The `mode: rollback` path (§6) |

The invariants it holds:

- **I1, tested tree.** It deploys only the tree a green PR tested; anything else runs full
  verify and e2e first.
- **I2, single writer, current main.** Stale and re-run runs deploy nothing, and every
  credentialed job re-checks `main` HEAD (`deploy-gate.mjs --check-head`).
- **I3, staged before live.** The server goes through a tagged no-traffic revision and
  hosting through a per-sha channel. Live never serves an unsmoked build.
- **I4, server first.** Promote moves server traffic before it clones hosting, and rollback
  runs in the reverse order.
- **I5, tag = live.** A failed or rolled-back run creates no tag, and its number is reused.
- **I7, credentials only on main.** The WIF secrets are `production` environment secrets.
  That environment is limited to `main`, and the WIF condition is pinned to
  `refs/heads/main`. Only `server`, `hosting`, `promote`, `rollback` and `restore` declare
  it, and no PR job can get a credential.

**Re-runs.** "Re-run failed jobs" skips `gate` and reuses its outputs. The credentialed jobs
therefore re-check `main` HEAD themselves, and an old run's re-run refuses once `main` has
moved on. `rollback` deliberately skips that check: it reverts only what that run itself
put live (below), so a merge landing mid-deploy cannot strand a half-done promote. A
re-run of an old `mode: rollback` run recomputes its plan against the current Releases.

### How the plan picks targets

`scripts/release.mjs` reads what is live: the server sha from `GET /health`, and the hosting
sha from the `vega-build` meta on https://vega-life-os.web.app/ (cache-busted). It diffs each
against `HEAD` and classifies every changed file with `scripts/lib/change-scope.mjs`:

| Path | Deploys |
|---|---|
| `apps/web/**`, `firebase.json`, `.firebaserc` | hosting |
| `apps/server/**`, `cloudbuild.server.yaml`, `scripts/deploy-server.sh` | server |
| `packages/shared/**`, `package.json`, `package-lock.json`, `apps/web/package.json`, `.github/workflows/deploy.yml` | both |
| `docs/**`, `*.md` outside `apps/` and `packages/`, `.claude/**` | nothing |
| tooling: `scripts/`, `.github/`, `.husky/`, `infra/`, `biome.json`, `knip.json`, `tsconfig.json`, `firestore.rules`, `.gitignore`, `.gitattributes`, `.nvmrc`, `.env.example` | nothing |
| **anything else** | **both** |

- `apps/web/package.json` ships both, because the server image installs every workspace
  manifest.
- `deploy.yml` ships both, because it holds the build env and the deploy flags.
- **Fail safe:** a live sha that is missing, unreachable, `dev`, not a hex sha, or not in
  git history deploys that target.
- **When nothing changed,** the run ends green with no tag.
- **Config outside git** (GitHub variables and secrets, `.env` files) never triggers a
  deploy. After changing it, run `gh workflow run deploy.yml --ref main -f targets=both`.

### Versions and release records

Decided in [ADR 0005](adr/2026-10-22-0005-calendar-versioning.md), amended 2026-10-24.

- **One product version** for both targets, CalVer **`vYYYY.M.N`**: `N` is the nth release
  of that UTC month (`v2026.10.1`, `v2026.11.1`).
- **It exists only as a git tag.** Never bump a `package.json`.
- **One sha, one version:** a re-deploy of a tagged sha keeps its version and records
  nothing.
- **Stamped** into both builds through `VEGA_VERSION`: `/health` reports it, and the web
  build emits `<meta name="vega-version">`. Settings → About shows
  `version · short sha · schema hash`.
- **GitHub Releases are the record.** The notes are the squash-merged PR titles since the
  previous tag, grouped by type, then a **Deploy** block:
  - each target shipped or skipped, with the plan's reason;
  - the server revision and image;
  - the **live hosting version id**;
  - the schema hash, the commit and the run link;
  - the break-glass marker, when the release was cut on the laptop.

  `mode: rollback` reads this block.
- **`CHANGELOG.md` is a stub** pointing at the Releases. `npm run changelog` renders the
  full mirror on demand, and it isn't committed after releases.
- **Recording is idempotent.** If `record` fails, production is already updated: *Re-run
  failed jobs* finishes it.

### Why the server goes first

The server validates every write against the shared Zod schemas and **strips unknown keys**
(`defineEntity` in `packages/shared/src/entities/base.ts`). A hosting build that knows a new
field, talking to a server that doesn't, writes that field into the void — silently, with a
200. The reverse is safe: a new server accepts an old client's writes, which just lack the
new field.

**Expand, then contract (I8).** PWA clients lag (§9), so the server must keep accepting the
previous client's payloads. Never rename or remove a field an old client still sends: add the
new shape in one release, and remove the old one in a later release once no client sends it.

### Schema hash and `/health`

`packages/shared` exports `SCHEMA_HASH`: an FNV-1a 64 digest (12 hex chars) of the
key-sorted `z.toJSONSchema` of every stored entity schema plus `profilePatchSchema`. Any
field added, removed, retyped or made optional changes it.

- The server reports it: `GET /health` → `{ ok, version, sha, schemaHash }`. `sha` is the
  `GIT_SHA` build-arg baked into the image and `version` the `APP_VERSION` one (`"dev"`
  when unset).
- The web build stamps it into `index.html` as `<meta name="vega-build">` (short sha),
  `<meta name="vega-schema">` and `<meta name="vega-version">`, and defines
  `__BUILD_SHA__` / `__SCHEMA_HASH__` / `__APP_VERSION__` (shown in Settings → About).
- `npm run check:live-schema` (`scripts/check-live-schema.mjs`) GETs the live `/health`,
  prints its `sha` and `schemaHash`, and fails with "deploy the server first" when the
  hash differs from the local one or is missing. The URL comes from `VEGA_API_URL`, else
  `VITE_API_URL` from the environment, else the `VITE_API_URL` line of the repo-root env
  files; a URL read from a file is never printed.

### The `@smoke` set

`apps/web/playwright.smoke.config.ts` runs only the tests tagged `{ tag: "@smoke" }`, against
`SMOKE_BASE_URL`. It refuses to run without that variable and starts no local server. It runs
the signed-out sandbox only, so it makes no `/trpc` calls and needs no CORS or Auth change for
the channel origin.

To add a smoke test, tag a signed-out, read-mostly test. Keep the set to about two minutes.

### GitHub configuration

- **Secrets:** the WIF secrets live in the `production` environment
  (`infra/setup-ci-release.sh`, [`infra/gcp-setup.md`](../infra/gcp-setup.md)).
- **Variables:** `GCP_PROJECT` and every `VITE_*` value are repository *variables*. They are
  public anyway, and GitHub masks secret values out of job outputs: a project id stored as a
  secret blanked every output that contained it (the deploy URLs) and broke the staging
  hand-offs.
- **Keep secrets for real secrets.**

## 6. Rollback

**Automatic.**
- A staged failure (server tag smoke, channel, `@smoke`) means nothing went live. `rollback`
  drops the tag and deletes the channel.
- A failure after promote rolls back in reverse order:
  1. **Hosting.** It clones the recorded previous version back to live, but only while live
     is still this run's version or build.
  2. **Server.** It routes traffic back to the recorded split, but only while this run's
     revision serves it, and only once hosting is back on the previous version.
  3. **Anything newer** is left alone and logged.
- **Live state it can't read** fails the job loudly, naming this runbook. A human has to
  finish the job.

**The fast path: `mode: rollback`.** It goes one release back from the newest Release,
hosting first. Each target goes to the newest older release that shipped it, using the
hosting version and server revision recorded in that release's Deploy block.

```bash
gh workflow run deploy.yml --ref main -f mode=rollback -f dry_run=true   # print the plan only
gh workflow run deploy.yml --ref main -f mode=rollback                   # do it
```

It refuses by name for a target release that recorded no ids: v2026.10.6 and older, and
laptop releases. Use the runbook below for those. A newer merge can supersede a pending
rollback, so re-dispatch if that happens.

**Preferred: a revert PR.** It goes through the normal flow and deploys like any change. A
rollback leaves `main` ahead of production until the revert or a fix merges.

**The data cost (I8).** A server rollback can drop fields that only the newer clients write,
because the older server strips them. Prefer rolling forward with a fix over rolling back a
schema change.

### Manual runbook

Roll back in the **reverse** of the release order — hosting first, so no client is left
writing fields the older server would strip.

1. **Hosting.** In the Firebase console → Hosting → release history, pick the previous
   release and *Roll back*. From the CLI, take that release's version id and clone it onto
   live:
   ```bash
   npm run deploy:rollback -- vega-life-os@<versionId> vega-life-os:live
   ```
   (`hosting:clone` under the hood — firebase-tools 15 has no `hosting:rollback`.)
2. **Server.** Find the previous healthy revision and pin all traffic to it:
   ```bash
   gcloud run revisions list --service vega-server --region us-central1 --project vega-life-os
   gcloud run services update-traffic vega-server --to-revisions=<prev-revision>=100 \
     --region us-central1 --project vega-life-os
   ```
   Confirm with `curl <run-url>/health` — the `sha` is the rolled-back commit.
3. **Un-pin after the fix.** While traffic is pinned, a new revision gets **0%** of traffic.
   The next deploy's `--to-latest` un-pins it; by hand:
   `gcloud run services update-traffic vega-server --to-latest --region us-central1 --project vega-life-os`.

## 7. Break-glass: a GitHub outage while production is broken

The laptop path exists only for this. Without `--break-glass` it refuses and points here.

1. **Merge the fix PR with the admin bypass:** `gh pr merge <n> --squash --admin`. The
   checks can't run, and the bypass is logged.
2. **Release from a clean `origin/main`:** `npm run release -- --break-glass`.

What it does:
- runs the full `verify` (e2e included) plus `smoke:server-bundle` locally, whatever CI
  says. Semgrep has no local install, so the notes say it did not run;
- deploys the server staged: a no-traffic tagged revision, then the tag `/health` and schema
  checks, then traffic (`scripts/deploy-server.sh`);
- before each target, checks that no `deploy.yml` run is active. An unreadable GitHub warns
  and proceeds;
- marks the release notes `Path: break-glass`.

The standalone deploys need the flag too:
- `npm run deploy:server -- --break-glass`;
- `RELEASE_BREAK_GLASS=1 npm run deploy`. `npm run deploy -- --break-glass` doesn't work,
  because npm hands the flag to firebase-tools, not to the guard.

`--allow-red-ci` is folded into `--break-glass` and refused by name. Once Actions recovers,
queued deploy runs plan nothing: the sha is already live.

## 8. Drills

`deploy.yml`'s `drill` input forces a failure to prove the rollback. Run a drill only on a
sha that is already live, with `-f targets=both`.

- `fail-staged-smoke`:
  - `smoke` fails, and promote and record skip;
  - rollback drops the tag and deletes the channel;
  - live is unchanged, and no tag is created.
- `fail-after-promote`:
  - promote completes, then fails;
  - rollback clones hosting back to the pre-drill version, then routes traffic back;
  - no tag is created.

  Traffic stays pinned to the old revision until the next deploy's `--to-latest`.

## 9. After a release — the PWA lag

The app is a PWA with `registerType: "prompt"`: an installed client keeps running the
service-worker-cached bundle until the user accepts the update prompt or the tab is
hard-reloaded. Old bundles stay live for hours or days after a deploy — another reason the
server must stay compatible with the previous client.

To check what hosting is actually serving, bypass the service worker:
`curl -s https://vega-life-os.web.app | grep vega-build`, or hard-reload
(Ctrl+Shift+R) and read the `vega-build` meta tag.

## 10. Document the change

Specs, plans, ADRs, and run reports follow the naming in `CLAUDE.md §6` —
`docs/specs/`, `docs/plans/`, `docs/adr/`, `docs/runs/` (all but `adr/` are local-only and
gitignored) — every filename ISO-date-prefixed (`YYYY-MM-DD-`). Transcribe any decision
(e.g. from a clarifying question) into the spec verbatim; never silently soften a
destructive-action guard.

## 11. Cards performance benchmark

`npm run perf:cards` seeds synthetic cards into the signed-out sandbox and measures
`/cards` (table, search, select, sort, gallery), `/cards/:id` and `/brainwrite` through long
tasks, event timing, heap and scroll frame rate. Run it against a production build, not dev:

```bash
npm run build
npm run preview -w @vega/web -- --port 5301 --strictPort
npm run perf:cards -- http://localhost:5301 1000,5000,10000
```

Options: `--mobile`, `--throttle=4` (CPU slowdown), `--skip-gallery`, `--skip-brainwrite`,
`--boot-only`, `--json=<path>`, `--profile=<dir>` (one `.cpuprofile` per size) and `--help`.
Write outputs outside the repo (`%TEMP%\claude-scratch\`). Compare runs on the same machine.
