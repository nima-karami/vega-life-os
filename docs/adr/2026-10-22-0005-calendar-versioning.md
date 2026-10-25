# ADR 0005 — Calendar versioning and release records

Date: 2026-10-22
Status: Accepted

## Context

Nothing recorded what shipped or when. The repo had no release tags, no GitHub Releases and
no changelog, and all four manifests had said `0.1.0` since the first commit. What is live
*now* was traceable (`/health` → `sha`, `<meta name="vega-build">`); what shipped on a given
day, and what changed since the release before it, was not — except by reading Cloud Run
revisions, Hosting history and agent memory notes outside the repo.

User decision, verbatim: "Yeah go ahead and get this done auto mode" — approving the design
below.

## Decision

- **One product version for both targets.** Server and hosting ship from the same `main`
  sha and the user sees one product. Which targets moved in a release is recorded in that
  release's deploy manifest, not in a second tag stream.
- **CalVer `vYYYY.M.N`.** `N` is the nth release of that UTC month, starting at 1, so
  `v2026.10.1` is the first release of October 2026. The month is not zero-padded, which
  keeps the tag valid SemVer syntax: `git tag --sort=v:refname` and semver tooling order it
  correctly. `scripts/lib/next-version.mjs` computes it from the existing `v*` tags that
  match the pattern and ignores every other tag (e.g. `archive/paper-wip`).
- **One sha, one version** (conductor decision, 2026-10-22). If `HEAD` already carries a
  `v*` tag, a forced or config-only re-release stamps that existing version into both
  builds and records nothing new: no second tag, no new GitHub Release. The plan says
  "sha X is already vN — re-deploying as vN, nothing recorded" and reports `record: false`.
- **The version lives only in git tags.** It is never written to `package.json`: a manifest
  change classifies as *both* targets in `scripts/lib/change-scope.mjs`, so a bump would
  redeploy everything on the next release, and it would need a bump commit per release.
- **GitHub Releases are the source of truth.** After every release that shipped at least one
  target and failed none, the release workflow's `record` job (or `scripts/release.mjs` on
  the laptop) creates an annotated tag on the released sha and a GitHub Release. The notes
  come from `scripts/release-notes.mjs`: conventional commits since the previous `v*` tag,
  grouped by type, merge commits dropped, `@` mentions put in code spans; the first release
  says "First versioned release. Earlier history: the git log." instead of a commit log.
  Then a deploy manifest — targets shipped or skipped (with the plan's reason), server
  revision and image, schema hash, build sha, the Actions run. A failed or rolled-back
  release creates no tag; its number is reused. Recording is idempotent: an existing tag on
  the released sha and an existing Release are kept, a tag on another sha fails loudly.
- **`CHANGELOG.md` is a regenerated mirror.** `npm run changelog` rebuilds it from the
  GitHub Releases. It is committed with an ordinary commit, never by CI: a commit pushed
  with `GITHUB_TOKEN` gets no verify run, so the release gate would refuse that sha. It is
  a docs path, so committing it ships nothing.
- **The version is stamped into both builds.** The server image gets build arg
  `APP_VERSION` (`/health` → `{ ok, version, sha, schemaHash }`); the web build reads
  `VEGA_VERSION` into a `__APP_VERSION__` define and `<meta name="vega-version">`. Any
  build outside a release says `dev`. Settings → About shows version · short sha · schema
  hash. `sha` stays the machine identity — the release plan diffs on it.
- **No new dependencies.** The notes generator is ~100 lines over `git log`; git-cliff
  would add a binary and a config file for the same output.

## What would change it

A server consumer that does not ship in lockstep with this SPA — a native client, a public
API, a second app on `@vega/shared`. Then the API is a contract, and the server moves to its
own SemVer stream (`server/v1.x`). The CalVer product version stays for the app.

## Rejected

| Option | Why not |
|---|---|
| SemVer | Encodes a compatibility promise to consumers; there are none. The real contract is already machine-checked by `SCHEMA_HASH` + server-first. Major/minor would be meaningless judgment calls |
| Per-target versions | Same sha, one product; two tag streams double the bookkeeping for detail the manifest already carries |
| Changesets | Built for publishing npm packages; a hand-written file per change, and it bumps manifests |
| release-please | "Merge the release PR = release" fights the push-button, target-aware flow, and it bumps `package.json` (→ both targets) |
| semantic-release | SemVer, releases on every push, heavy plugin stack |
| Hand-written changelog | The log is already conventional; a curated file rots |
| CI commits `CHANGELOG.md` | That commit would have no verify run, so it could not be released without a PAT or App token |

Skipped as overkill: SECURITY.md, CODE_OF_CONDUCT, CONTRIBUTING.md, CODEOWNERS, issue/PR
templates, a LICENSE file, commitlint/commitizen, signed tags, SBOMs, release branches, a
staging environment, per-workspace READMEs, manifest version bumps.

## Consequences

- "What shipped on date X, and what changed since the release before?" is one GitHub
  Release, and an installed PWA shows its version in Settings.
- `npm run release -- --no-record` exists for emergencies; it deploys unversioned (`dev`)
  and leaves no tag, so the next release takes the number.
- Recording happens after the deploys. If it fails, production is already updated and
  nothing rolls back; the failure is loud. In CI, "re-run failed jobs" finishes it; on the
  laptop a failed tag push deletes the local tag ("not tagged, nothing recorded") and a
  failed Release prints the `gh release create` to finish it.
- The laptop path refuses while a `release.yml` run is queued or in progress, and refuses
  before deploying when recording is due but `gh` is not authenticated.
- The `record` job and the laptop recording can only be proven by a real release.

## Amendment — 2026-10-24: CHANGELOG on a protected main

**Context.** `main` is now protected (`docs/specs/2026-10-24-ci-cd-trunk-flow.md`), so the
post-release `CHANGELOG.md` commit would need its own PR for every release.

**Decision** (owner, 2026-10-24, §14 Q2: "Yep all good. Go ahead"):
- GitHub Releases stay the only record.
- `CHANGELOG.md` becomes a stub that points at them. `npm run changelog` renders the full
  mirror on demand, and nobody commits it after a release.
- CI never commits it.

**Also:**
- `deploy.yml` now cuts a release on every merge that deploys something.
- Release-note subjects are the squash-merged PR titles, which `pr-title` gates.
- The Deploy manifest also records the live hosting version id, which `mode: rollback` reads.
- Unchanged: CalVer, one sha = one version, and tag = live.

**Supersedes** the "`CHANGELOG.md` is a regenerated mirror" bullet above. That bullet stays
as written, since ADRs are history.
