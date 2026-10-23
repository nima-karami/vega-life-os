# VEGA Life OS — Release Process

How a change travels from a branch to vega-life-os.web.app and the `vega-server` Cloud Run
service. Code style (naming, comments) lives in **[`style-guide.md`](style-guide.md)**;
this doc is the workflow.

---

## 1. Branch

Work on a branch off `main`. Keep commits small and each one green.

## 2. Commit — Conventional Commits

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
- The `Co-Authored-By` trailer is required.
- **Commit and push only when the user asks** — never auto-commit or auto-push.
- Before every commit run `git status` and confirm **only intended files** are staged.
  Scratch artifacts (screenshots, logs, scratch scripts) go to `%TEMP%\claude-scratch\`,
  never the repo.

## 3. Verify — the gate

`npm run verify` must pass locally before the change is done. It runs, in order:

```
format:check → lint → typecheck → deadcode → check:lockfile → check:suppressions → test
  → dupes → scan:secrets → audit:deps → e2e
```

Never `--no-verify`; never weaken a check to get through it (see `style-guide.md §1`).
Each layer runs a different slice of it:

| Where | Runs |
|---|---|
| **pre-commit** (husky) | `lint-staged` (Biome on staged files) + `gitleaks` on the staged diff |
| **pre-push** (husky) | the gate minus e2e, the audits, the secret scan and the lockfile / suppression checks: format, lint, typecheck, deadcode, test, dupes. Needs JDK 21 first on `PATH` (server tests boot the Firestore emulator) |
| **CI** (`verify.yml`, on push to `main`, every PR, and `workflow_dispatch`) | `changes`: scope detection (below) · `static`: format, lint, typecheck, deadcode, dupes, lockfile-platform check, suppression check, script tests, npm audit, OSV, gitleaks · `unit`: web / shared · `unit-server`: server (with Java 21) · `e2e`: chromium in 3 shards, mobile-chromium in 2, the PWA project · `sast`: Semgrep |

The full e2e suite only runs locally on `npm run verify` and in CI, so a release is gated
on CI being green for the exact commit (§5).

### CI change scope

By explicit user decision (2026-10-22), CI skips work a change cannot affect.
`scripts/ci-scope.mjs` diffs the push's `before` sha (or the PR's base) against `HEAD`:

| Changed files | Scope | Skipped |
|---|---|---|
| only `docs/**`, `*.md`, `.claude/**` | `docs` | `e2e`, `unit-server` |
| only those plus `apps/web/**` | `web` | `unit-server` |
| anything else | `full` | nothing |

`static`, `unit` (web, shared) and `sast` always run. A push narrows **only when its base
commit's own verify run succeeded** — otherwise a docs commit on top of a red one would be
green and releasable. No base, an all-zero base (new branch), an unknown sha,
`workflow_dispatch` or any detection error → `full`. Diffs use `--no-renames`, so a file
moved out of a slice still counts for that slice. Skipped jobs report `skipped`; the
release guard treats that as green **only for `unit-server` and `e2e`**, and the `release`
gate reads the workflow's overall conclusion.

**The risk, stated:** a web-only commit ships without the server suite having run on it,
and a docs-only commit without e2e. That is sound only while `apps/web/**` cannot change
server behaviour. Anything shared lives in `packages/shared/`, which forces `full`.

## 4. PR & merge

Open a PR; `verify.yml` runs on it. Merge to `main` once it is green. A shareable preview
is `npm run deploy:preview` (a 7-day Hosting channel), run from the laptop.

## 5. Release — server first, then hosting

The normal path is the `release` workflow ([Releasing from CI](#releasing-from-ci), end of
this section); `npm run release` is the laptop path. Both **deploy only the targets that
changed since what is live**, server always before hosting:

```bash
npm run release -- --dry-run   # print the plan and the version it would cut, deploy nothing
npm run release                # guard → plan → deploy:server and/or deploy → tag + GitHub Release
```

The two deploys stay as manual overrides that always ship their target:

```bash
npm run deploy:server   # guard → Cloud Build from HEAD → Cloud Run → /health sha + schema check
npm run deploy          # guard → live-schema check → vite build → Firebase Hosting
```

### How `npm run release` picks targets

`scripts/release.mjs` runs the release guard, then reads what is live: the server sha from
`GET /health` (URL resolved as in [Schema hash and `/health`](#schema-hash-and-health)) and
the hosting sha from the `vega-build` meta on https://vega-life-os.web.app/ (cache-busted).
It diffs each against `HEAD` and classifies every changed file
(`scripts/lib/change-scope.mjs`, tested by `npm run test:scripts`):

| Path | Deploys |
|---|---|
| `apps/web/**`, `firebase.json`, `.firebaserc` | hosting |
| `apps/server/**`, `cloudbuild.server.yaml`, `scripts/deploy-server.sh` | server |
| `packages/shared/**`, `package.json`, `package-lock.json`, `apps/web/package.json`, `.github/workflows/release.yml` | both |
| `docs/**`, `*.md` outside `apps/` and `packages/`, `.claude/**` | nothing |
| tooling: `scripts/`, `.github/`, `.husky/`, `infra/`, `biome.json`, `knip.json`, `tsconfig.json`, `firestore.rules`, `.gitignore`, `.gitattributes`, `.nvmrc`, `.env.example` | nothing |
| **anything else** | **both** |

`apps/web/package.json` ships both because the server image installs every workspace
manifest. `.github/workflows/release.yml` ships both (it holds the `VITE_*` build env and
the server deploy flags) and `scripts/deploy-server.sh` ships the server; both are
matched before the tooling row. A `*.md` under `apps/` or `packages/` belongs to its
slice, not to docs. A rename counts for both its old and new path. **Fail safe:** a live
sha that is missing, unreachable, `dev`, not a hex sha, or not in git history deploys that
target. Nothing needed → it says so and exits 0.

Config that lives outside git (GitHub variables and secrets, local `.env` files) never
triggers a deploy — after changing it, force with `--only=…` or `-f targets=…`.

Flags: `--dry-run` (plan only, skips the guard), `--plan-json` (the plan as JSON, for CI),
`--only=server|hosting|both` (force), `--allow-red-ci` (passed to both deploys),
`--no-record` (emergencies only: deploy unversioned, no tag, no GitHub Release — see
[Versions and release records](#versions-and-release-records)).
`check:live-schema` still runs inside `deploy`, so a hosting-only release refuses if the
live server lags the build's schema.

### Versions and release records

Decided in [ADR 0005](adr/2026-10-22-0005-calendar-versioning.md). One product version for
both targets, CalVer **`vYYYY.M.N`**: `N` is the nth release of that UTC month, from 1, month
not zero-padded (`v2026.10.1`, `v2026.10.2`, `v2026.11.1`). It exists **only as a git tag** —
never bump it in a `package.json` (a manifest change ships both targets).

- **Computed** at plan time by `scripts/lib/next-version.mjs` from the `v*` tags (after a
  `git fetch --tags`); other tags such as `archive/paper-wip` are ignored. `--plan-json`
  carries it as `version`, plus `record`.
- **One sha, one version.** If `HEAD` already carries a `v*` tag, a forced or config-only
  re-release stamps that version into both builds and records nothing (`record: false`;
  "sha X is already vN — re-deploying as vN, nothing recorded").
- **Stamped** into both builds through `VEGA_VERSION`: the server image gets build arg
  `APP_VERSION` (`deploy-server.sh` → Cloud Build `_APP_VERSION`, or `docker build` in CI) and
  `/health` reports it; `vite build` defines `__APP_VERSION__` and emits
  `<meta name="vega-version">`. Anything built outside a release — dev, preview, a manual
  `deploy` / `deploy:server`, `--no-record` on an untagged sha — says `dev`.
- **Recorded** only after every planned deploy succeeded, only if at least one target
  shipped, and only for a new version: an annotated tag on the released sha, pushed, then
  `gh release create` with notes from `scripts/release-notes.mjs` — conventional commits
  since the previous `v*` tag, grouped by type, merge commits dropped, `@` mentions in code
  spans (the first release just says "First versioned release. Earlier history:
  docs/runs/.") — plus a **Deploy** section: each target shipped or skipped with the plan's
  reason, server revision and image, schema hash, build sha and (from CI) the run link. A
  failed or rolled-back release creates no tag and its number is reused.
- **Recording is idempotent.** A tag already on the released sha is kept (on another sha it
  fails loudly), and an existing Release is kept. If recording fails, production is already
  updated and nothing rolls back: in CI, *Re-run failed jobs* on the run finishes it; on the
  laptop a failed tag push deletes the local tag ("not tagged, nothing recorded") and a
  failed Release prints the `gh release create` command to finish it. The laptop also
  checks `gh auth status` before the first deploy when it will record.
- **One release at a time.** `npm run release` refuses while a `release.yml` run is queued
  or in progress — both would claim the same number and race the live revision. If they
  collided anyway, let the later one fail and re-release: the sha it shipped either got
  the tag (and re-deploys as that version) or gets the next number.
- **GitHub Releases are the record.** `CHANGELOG.md` mirrors them, newest first, ending in a
  "Before <oldest release>" pointer to `docs/runs/` ("Before versioned releases" until the
  first one exists). Regenerate with `npm run changelog` (needs
  `gh auth login`) and commit it with the next ordinary commit — it is docs, so it ships
  nothing. CI never commits it: a `GITHUB_TOKEN` commit gets no verify run and could not be
  released.
- **Seeing it:** Settings → About → *Version* shows `version · short sha · schema hash` of
  the running bundle — the quickest way to tell which build an installed PWA is on (§7).

### Why the server goes first

The server validates every write against the shared Zod schemas and **strips unknown keys**
(`defineEntity` in `packages/shared/src/entities/base.ts`). A hosting build that knows a
new field, talking to a server that doesn't, writes that field into the void — silently,
with a 200. The reverse is safe: a new server accepts an old client's writes, which just
lack the new field. So the server always ships first, and a release must never rename or
remove a field an old client still sends (PWA clients lag, see §7).

`npm run deploy` enforces this: it refuses unless the live server's schema already matches
the build's.

### The release guard — `npm run release:guard`

`scripts/release-guard.mjs` runs first in both deploys and refuses (exit 1) when:

- the working tree is dirty (`git status --porcelain`);
- `HEAD` is not `origin/main` after a `git fetch` — only pushed `main` ships;
- any GitHub check-run for `HEAD` is not `completed`/`success` (read with `gh api`; needs
  `gh auth login`). The one exception: `skipped` is green for `unit-server` and `e2e`,
  the jobs CI may skip by change scope ([CI change scope](#ci-change-scope)); any other
  skipped check is red (`scripts/lib/check-runs.mjs`).

`--allow-red-ci` (or `RELEASE_ALLOW_RED_CI=1`) downgrades only the CI check to a loud
warning — it exists until CI is green and is always passed explicitly:
`npm run deploy:server -- --allow-red-ci`, `RELEASE_ALLOW_RED_CI=1 npm run deploy`. The
dirty-tree and pushed checks can't be skipped.

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
  files (Vite's production precedence); a URL read from a file is never printed.

### Server deploy — what `deploy:server` does

`scripts/deploy-server.sh`, after the guard:

1. `git archive HEAD` → a tarball in the OS temp dir. Cloud Build gets exactly the
   committed tree — never untracked files, `.env.local` or a stray edit — so the image
   always matches the sha it is tagged with.
2. `gcloud builds submit <tarball> --config cloudbuild.server.yaml --substitutions
   _GIT_SHA=<short sha>,_APP_VERSION=<VEGA_VERSION or dev>` — builds
   `apps/server/Dockerfile` with `--build-arg GIT_SHA` and `APP_VERSION` on
   `E2_HIGHCPU_8` and pushes `us-central1-docker.pkg.dev/vega-life-os/vega/server:<sha>`.
3. `gcloud run deploy vega-server --image <that> --region us-central1` — **only**
   `--image`, so the service's env and Secret Manager bindings carry forward.
4. Asserts the live `/health` reports the new `sha`, then runs `check:live-schema`.

On Windows the script points `CLOUDSDK_PYTHON` at the SDK's bundled Python and calls
`gcloud.cmd` (the Store python alias otherwise breaks gcloud); set `GCLOUD` to override.

### Releasing from CI

One-time setup, by a human with owner rights on the GCP project and `gh auth login` done:

```bash
bash infra/setup-ci-release.sh
```

It creates the WIF pool/provider (main of this repo only), the least-privilege
`vega-deployer` SA, caps `vega-server` at 2 instances, and sets the repo secrets plus a
`VITE_*` variable per key in `.env.local`. Details and the role-by-role rationale are in
[`infra/gcp-setup.md`](../infra/gcp-setup.md). Re-run it when `.env.local` changes.

Then every release is:

```bash
gh workflow run release.yml --ref main && sleep 5 && gh run watch "$(gh run list --workflow release.yml --limit 1 --json databaseId --jq '.[0].databaseId')"
```

To force targets: `gh workflow run release.yml --ref main -f targets=both` (or `server`,
`hosting`; the default `auto` ships only what changed).

`release.yml` (`workflow_dispatch`, one release at a time, never cancelled by a newer one):

| Job | Does |
|---|---|
| `gate` | Refuses unless the ref is `refs/heads/main` and the latest `verify` run for this exact sha concluded `success`. |
| `plan` | `node scripts/release.mjs --plan-json` against the live shas (server URL from the `VITE_API_URL` variable) — the same classifier as the laptop path — and outputs `server` / `hosting`, their skip reasons, the `version` (next, or the one `HEAD` already carries) and `record` (checkout fetches all tags). |
| `server` | Only when `plan` says so. `docker build` with `GIT_SHA=<short>` and `APP_VERSION=<version>` → push `server:<short>` → record the serving traffic split → `gcloud run deploy --image <digest> --no-traffic --tag c-<short> --max-instances=2` → the tag URL's `/health` must report `<short>` and `check-live-schema` must pass against it → `update-traffic --to-latest`, drop the tag → the service URL must report `<short>`. |
| `hosting` | Only when `plan` says so, after `server` succeeded or was skipped. `npm ci` → `npm run build` with the `VITE_*` repo variables and `VEGA_VERSION=<version>` → `check-live-schema` against the service URL (the `VITE_API_URL` variable when `server` was skipped) → record the live Hosting version (`releases.list` on the live channel) → `firebase deploy --only hosting` via WIF/ADC → `https://vega-life-os.web.app/` must serve `<meta name="vega-build" content="<short>">` within ~2 minutes. |
| `record` | Only when the plan's `record` is true (the sha has no version yet), nothing failed or was cancelled, and at least one of `server` / `hosting` succeeded (a single skipped target is fine; both skipped → nothing shipped, no tag). `contents: write`. Reads the live `schemaHash`, writes the notes with `scripts/release-notes.mjs` (skip reasons from the plan), creates and pushes the annotated `<version>` tag on the released sha unless it is already there, `gh release create` unless the Release exists, and copies the notes into the run summary. Idempotent, so *Re-run failed jobs* recovers a failed record. |
| `rollback` | Runs only if `server` or `hosting` failed or the run was cancelled. |

**Rollback** runs in reverse release order:

1. If hosting was deployed, `hosting:clone vega-life-os@<recorded version> vega-life-os:live`.
2. If server traffic was moved, `update-traffic --to-revisions <recorded split>`.
3. If the `c-<short>` tag was created, remove it.

Each step keys off outputs the job set as it went, so a target the plan skipped is never
rolled back. A failure before traffic moves leaves production untouched: the new revision gets no
traffic and only its tag is cleaned up. After a server rollback, traffic is **pinned** to
the old revision, so un-pin it after the fix ships (step 3 of §6). The release workflow's
own `--to-latest` does that for you on the next successful run.

The laptop path (`npm run release`, or the two deploys by hand, described above) stays as
the fallback.

## 6. Rollback runbook

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
3. **Un-pin after the fix.** While traffic is pinned, a new `gcloud run deploy` creates a
   revision that gets **0%** of traffic (`deploy:server`'s sha assertion will fail loudly).
   Once the fix is deployed, return to normal with
   `gcloud run services update-traffic vega-server --to-latest --region us-central1 --project vega-life-os`.

## 7. After a release — the PWA lag

The app is a PWA with `registerType: "prompt"`: an installed client keeps running the
service-worker-cached bundle until the user accepts the update prompt or the tab is
hard-reloaded. Old bundles stay live for hours or days after a deploy — another reason the
server must stay compatible with the previous client.

To check what hosting is actually serving, bypass the service worker:
`curl -s https://vega-life-os.web.app | grep vega-build`, or hard-reload
(Ctrl+Shift+R) and read the `vega-build` meta tag.

## 8. Document the change

Specs, plans, ADRs, and run reports follow the naming in `CLAUDE.md §6` —
`docs/specs/`, `docs/plans/`, `docs/adr/`, `docs/runs/` — every filename ISO-date-prefixed
(`YYYY-MM-DD-`). Transcribe any decision (e.g. from a clarifying question) into the spec
verbatim; never silently soften a destructive-action guard.

## 9. Cards performance benchmark

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
