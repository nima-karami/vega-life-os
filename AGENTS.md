# AGENTS.md

Operational gotchas for VEGA Life OS that you cannot learn by reading the tree. Folder
structure and stack are discoverable (Glob/Grep) and deliberately not repeated here.

## The gate

`npm run verify` is the gate. It runs format-check, lint, typecheck, dead-code,
duplication, and security, and it runs on every commit (pre-commit hook) and in CI.
**Never disable, downgrade, narrow, or baseline-away a check to make progress** — fix the
code so the check passes. "It's only for local/dev" is not a reason to relax it. The same
gate runs identically in dev, pre-commit, and CI.

## Build / typecheck gotchas

- **`tsc --noEmit` is a no-op here.** This is a TypeScript *project-references* repo
  (`tsconfig.json` → `tsconfig.app.json` + `tsconfig.node.json`). The real typecheck is
  **`tsc -b`** (or `tsc -b --force` to bypass the stale `.tsbuildinfo` cache). The `verify`
  script already uses `tsc -b`.
- Dev server runs on **port 5180** (`npm run dev`), not Vite's default 5173.

## Connected-platform features are dormant by design

Firebase sync, the Anthropic-powered ⌘K agent, and Google Calendar sync are all built but
**gated** behind env vars / stored keys (`firebaseEnabled` / a stored Anthropic key /
`gcalConfigured`). With no config the app runs as a pure local-first Dexie app. Don't
"fix" the gated-off code paths thinking they're broken — they're waiting on secrets. The
roadmap + plans live in `.claude/docs/` (git-ignored on purpose; not in history).

## Anthropic client-side call contract

The browser agent calls Claude with model id **`claude-opus-4-8`** (exact id, no date
suffix) and `dangerouslyAllowBrowser: true`. Do **not** add `budget_tokens`,
`temperature`, `top_p`, or `top_k` to the request — the adaptive-thinking endpoint
**400s** on them. SDK 0.69 types lag the runtime payload, hence the deliberate cast in
`anthropic-agent.ts`.

## Hygiene

Scratch/throwaway artifacts (screenshots, scratch scripts) go to the OS temp dir, never
the repo. Before any commit, `git status` should show only intended files.
