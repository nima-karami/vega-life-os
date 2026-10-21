# ADR 0002 — Adopt a written coding standard

Date: 2026-07-12
Status: Accepted

## Context

The repo already has a strong, enforced tooling gate (`npm run verify`: Biome
format+lint, Knip dead-code, jscpd duplication, `tsc -b`, Vitest, gitleaks, npm
audit + osv-scanner, Playwright e2e), wired into both pre-commit and CI. An audit
against the solidify-repo rubric scored four of five agent-readiness categories
**Pass** and the tree is genuinely clean (zero `TODO`/`FIXME`, no stray artifacts,
`tsbuildinfo` gitignored).

The gap was **human-facing**: conventions existed only in the maintainers' heads or
implicitly in the code — file naming, variable naming, the comment policy, the
Conventional-Commits format, and the release process were never written down. For
human↔agent collaboration that tacit knowledge is a liability; each new contributor
(or agent loop) re-derives or drifts from it.

## Decision

- Split the standard into **two focused docs** — code style stays pure, workflow is
  separate:
  - **`docs/style-guide.md`** — the gate, folder/file structure, and prescriptive
    naming (functions verb-first, types are nouns, the 2–4-word length rule with
    good/bad pairs), comment policy (default none; explain _why_ not _what_), imports,
    cleanliness.
  - **`docs/release-process.md`** — branching, Conventional-Commits format, the
    `npm run verify` gate, PR/preview/merge, and `npm run deploy`.
  - Both grounded in the repo's actual conventions, cross-linked to each other and to
    `CLAUDE.md` (which stays the authoritative agent operating manual).
- Discoverable via pointers from `CLAUDE.md §5` and `README.md`.
- Scope this pass: **standard only, no behavior-changing refactor.**

### Skipped / deferred (deliberately)

- **SAST (Semgrep)** — the one genuine tooling hole (SAST layer of the security
  triad; secrets + dep-audit already exist). Not added this pass; pending maintainer
  go-ahead.
- **Complexity gate `warn → error`** — Biome's `noExcessiveCognitiveComplexity` stays
  `warn` for now; pending maintainer go-ahead.
- **`CalendarPage.tsx` (1,700 lines)** — the one structural outlier (next largest file
  is 745). Logged here as tracked debt to split by responsibility in a later pass.
- **Test-location inconsistency** — tests live both in `__tests__/` folders and
  colocated (e.g. `core/store/auth-transition.test.ts`). The standard sets
  `__tests__/` as canonical; existing colocated stragglers are debt, not moved this
  pass to avoid churn.

## Consequences

- New code has a written bar to meet; reviewers and agents cite a document instead of
  re-arguing conventions each time.
- No enforcement changes — the standard mostly restates what `verify` already enforces,
  so no new gate failures are introduced by this pass.
- Two gate improvements (SAST, complexity-as-error) and one refactor (CalendarPage
  split) remain open follow-ups, recorded above.

## Correction (2026-10-21)

"Wired into both pre-commit and CI" overstated it: pre-commit runs lint-staged + gitleaks
only; pre-push runs the gate minus e2e; CI runs everything. Knip currently checks files,
dependencies and unlisted deps (not exports), and complexity is warn-only; both are planned
ratchets.
