# ADR 0001 — Repository solidification for human/agent collaboration

Date: 2026-06-16
Status: Accepted

## Context

VEGA Life OS (Vite + React 18 + TS, feature-sliced, ~109 `src/` files) had no
deterministic checks, no single verify entry point, no security scanning, and no
runtime/e2e tests. "Working" meant "the build compiles" — which never proves a view
renders. We hardened the repo against the five agent-readiness categories so humans and
AI agents can work the same code without it rotting (dead code, clones, runaway
complexity) or shipping blank screens.

Tool selections follow the curated `solidify-repo/references/tooling-2026.md` (JS/TS
column); each was version-checked and pinned before install.

## Decision

1. **Instruction file** — added a short `AGENTS.md` of non-discoverable gotchas only
   (the `tsc --noEmit` no-op, port 5180, dormant gated features, the Anthropic
   client-side call contract). `HANDOFF.md` left as narrative history.

2. **Deterministic checks**
   - **Biome 2.5.0** (format + lint + cognitive-complexity). Config matched to the
     existing 2-space style. `noCommentText` disabled because the HUD intentionally uses
     `//`-prefixed labels as a design motif (25 files) — a design-language conflict, not
     a relaxation. All other recommended rules at full strength.
   - **Knip 6.17.1** for dead code/unused deps. Feature barrels declared as entries
     (type-aware resolution handles this architecture; **fallow was evaluated and
     rejected** — on this barrel-heavy TS repo it produced 78 mostly false-positive
     findings vs Knip's 15 real ones, because fallow does no TS type resolution).
   - **jscpd 5.0.9** duplication gate at 5% (repo is at ~1.8%).
   - Real typecheck wired as **`tsc -b`** (the old `tsc --noEmit` script was a no-op
     under TS project references).
   - **Pre-commit** via Husky 9 + lint-staged: Biome auto-fix on staged files + gitleaks
     staged scan.

3. **One verify harness** — `npm run verify` chains
   format-check → lint → typecheck → deadcode → dupes → secrets → dep-audit → e2e,
   non-zero on first failure. Also the CI gate (`.github/workflows/verify.yml`).

4. **Security gate (all three layers)**
   - **SAST: Semgrep**, CI-only (`semgrep scan --config auto --error`) per the
     speed tradeoff — slowest layer, still gates merges.
   - **Dependency audit: `npm audit` + osv-scanner** (installed via `go install`), local
     + CI. SAST does not cover dependencies, so this is separate and required.
   - **Secrets: gitleaks** (`go install`), pre-commit + CI history scan.

5. **Runtime QA + unit tests**
   - **Playwright 1.61** thin smoke (`e2e/smoke.spec.ts`) — boots the real app and asserts
     each of the 10 spine views renders real content with no uncaught errors, capturing a
     screenshot per view. Clears first-run onboarding (seeds demo data) in a `beforeEach`.
   - **Vitest 4.1** (`npm run test`, in `verify`) — 36 focused unit tests over the pure
     logic e2e can't reach: the calendar-sync reconciler (`computePush`/`computePull`), the
     event mapper round-trip (`toGEvent`/`fromGEvent`/`isSchedulable`), the agent
     date/time intent parser (`parseWhen`), and the `date`/`align` helpers. Node
     environment; relative-date tests pin the clock with `vi.setSystemTime`; timezone-safe
     assertions (round-trip + wall-clock prefix, no hard-coded offsets).

## Backlog handling

- **Lint backlog (144 → 0):** the user chose to FIX all, not baseline. `useButtonType`
  (63) bulk-fixed with `type="button"` (no `<form>` submits exist); the remaining ~100
  (non-null assertions, array-index keys, iterable-callback returns, a11y) fixed
  behavior-preservingly and verified by `tsc -b` + the e2e smoke (all 10 green). No
  `biome-ignore` suppressions, no rule disabled to pass.
- **Dependency vulns (14 → 0):** all pre-existing and transitive (firebase, esbuild). The
  user chose to UPGRADE rather than allowlist: **firebase 10 → 12** and **Vite 6 → 8**
  (with matched `@vitejs/plugin-react` 6 + `@tailwindcss/vite` 4.3). Cleared every
  advisory; typecheck + build + all 10 e2e re-verified green afterward.

## Consequences

- `npm run verify` is the single gate, green today, enforced in pre-commit and CI; new/
  changed code must pass every check. Disabling or downgrading a check to make progress
  is prohibited (stated in `AGENTS.md`).
- `claude-design-handoff/` and `ui-inspo/` are reference-only and excluded from all
  tooling.
- Security CLIs (gitleaks, osv-scanner) live in `~/go/bin` (on PATH); contributors
  without them get a graceful local skip — CI still gates those layers.
- Follow-up (not blocking): pin CI action `uses:` to commit SHAs (supply-chain
  hardening); consider code-splitting the three.js lab bundle (>500 kB chunk warning,
  pre-existing).

## Correction (2026-10-21)

- SAST does not "gate merges": branch protection is unavailable on a private free-plan
  repo, so a red CI job blocks nothing by itself.
- `verify` is not run in pre-commit. Pre-commit runs lint-staged + gitleaks; pre-push runs
  the gate minus e2e; CI runs everything. See `docs/plans/2026-10-21-gate-hardening.md`.
