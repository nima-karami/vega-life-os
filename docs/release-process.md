# VEGA Life OS — Release Process

How a change travels from a branch to vega-life-os.web.app. Code style (naming,
comments) lives in **[`style-guide.md`](style-guide.md)**; this doc is the workflow.

---

## 1. Branch

Work on a branch off `main`. Keep commits small and each one green — the pre-commit gate
enforces this, so a broken commit can't land.

## 2. Commit — Conventional Commits

Lowercase, imperative, no trailing period:

```
type(scope): subject

optional body — the why, wrapped ~72 cols

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

- **type:** `feat` · `fix` · `docs` · `chore` · `refactor` · `test` · `perf`.
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
format:check → lint → typecheck → deadcode → test → dupes → scan:secrets → audit:deps → e2e
```

Same gate runs pre-commit (husky/lint-staged) and in CI (`verify.yml`). Never
`--no-verify`; never weaken a check to get through it (see `style-guide.md §1`).

## 4. PR & merge

Open a PR. `preview.yml` builds a preview deploy. Merge to `main` once verify is green.

## 5. Ship

```bash
npm run deploy      # tsc -b && vite build, then Firebase Hosting → vega-life-os.web.app
```

Deploy is currently a **deliberate manual step**, not auto-on-merge (CI auto-deploy is
wired in `deploy.yml` but pending GitHub secrets).

## 6. Document the change

Specs, plans, ADRs, and run reports follow the naming in `CLAUDE.md §6` —
`docs/specs/`, `docs/plans/`, `docs/adr/`, `docs/runs/` — every filename ISO-date-prefixed
(`YYYY-MM-DD-`). Transcribe any decision (e.g. from a clarifying question) into the spec
verbatim; never silently soften a destructive-action guard.
