# ADR 0004 — Target-aware release and change-scoped CI

Date: 2026-10-22
Status: Accepted

## Context

Every release shipped both targets: `npm run deploy:server` (Cloud Build + Cloud Run,
minutes) then `npm run deploy` (vite build + Hosting), and the `release` workflow did the
same. Most commits touch only `apps/web`, so the server was rebuilt and re-rolled for
nothing, and docs commits re-deployed everything. CI likewise ran the full matrix —
including the Firestore-emulator server suite and nine e2e shards — for a README edit.

User decision, verbatim: "Yeah go. Just improve our release flow". The conductor's pick
for CI: **docs-only change → skip e2e and server tests; web-only change → skip the server
test suite (Firestore emulator); everything else runs the full gate.**

## Decision

- **One classifier, two consumers.** `scripts/lib/change-scope.mjs` is pure and unit-tested
  (`npm run test:scripts`, Node's built-in `node:test` — the scripts had no runner and this
  adds no dependency). `classifyChangedFile` maps a path to its deploy targets;
  `planTarget` decides one target from the live sha and the diff; `classifyCiScope` maps a
  change list to `docs | web | full`.
- **Deploy targets.** `apps/web/**`, `firebase.json`, `.firebaserc` → hosting.
  `apps/server/**`, `cloudbuild.server.yaml`, `scripts/deploy-server.sh` → server.
  `packages/shared/**`, root `package.json`, `package-lock.json`, `apps/web/package.json`
  (the server image installs every workspace manifest), `.github/workflows/release.yml`
  (build env + deploy flags) → both. Docs, `*.md` outside `apps/`/`packages/`,
  `.claude/**` and repo tooling that neither
  artifact contains (`scripts/`, `.github/`, `.husky/`, `infra/`, `biome.json`, `knip.json`,
  root `tsconfig.json`, `firestore.rules` — no release deploys rules) → nothing. **Any
  other path → both.**
- **`npm run release`** (`scripts/release.mjs`): guard → read the live server sha from
  `/health` (URL resolved by `scripts/lib/live-endpoints.mjs`, shared with
  `check-live-schema`) and the live hosting sha from the `vega-build` meta → diff each
  against `HEAD` → deploy the needed targets, server first. A live sha that is missing,
  unreachable, `dev` or not in git history deploys that target. `--dry-run`, `--plan-json`
  and `--only=server|hosting|both` exist; `deploy` and `deploy:server` stay as manual
  overrides and `check:live-schema` stays inside `deploy`.
- **`release.yml`** gains a `plan` job running the same script, gates `server` and
  `hosting` on it, and a `targets` input (`auto | both | server | hosting`) to force.
  Rollback acts only on outputs a job actually set, so a skipped target is never touched.
- **`verify.yml`** gains a `changes` job. Static checks and SAST always run. A push narrows
  only when its base commit's own verify run succeeded; detection errors, a missing base, a
  new branch or `workflow_dispatch` all resolve to `full`.
- Diffs run with `--no-renames` (a rename otherwise lists only its destination) and only
  ever receive a validated hex sha.
- **The release guard counts `skipped` as green only for `unit-server` and `e2e`**, so a
  narrowed verify is releasable and any other skipped check still blocks.

## Consequences

- A web-only release no longer touches Cloud Run; a docs-only release deploys nothing.
- **Accepted risk (CI):** a web-only change ships without the server suite having run on
  that commit, and a docs-only change without e2e. That is safe only while the
  classifier is right about what each target contains — a server import from
  `apps/web/**` would slip through. The base-must-be-green rule stops a docs commit from
  laundering a red predecessor.
- **Accepted risk (release):** a new top-level file the classifier doesn't know deploys
  both — wasteful, never unsafe. A file wrongly listed as tooling would be the unsafe
  case; the list is short and lives next to its tests.
- The workflow changes can only be proven on a real push / `workflow_dispatch`.
