# CLAUDE.md

Operating manual for agents working in **VEGA Life OS** — a personal life command
center (Values → Goals → Habits → Tasks, a B&W HUD + ⌘K agent).
This file is authoritative. Where it conflicts with habit or default behavior,
**this file wins.** Folder structure and stack are discoverable; only what you
can't learn by reading the tree, or must never get wrong, is written here.

---

## 0. Read these first — non-negotiable

Before you write, rename, or commit **any** code, actually **open and read in full**:

1. **[`docs/style-guide.md`](docs/style-guide.md)** — naming, comments, structure.
2. **[`docs/release-process.md`](docs/release-process.md)** — commits, the gate, deploy.

Use the Read tool on both files. **Seeing the link is not reading the file.** Skimming
the filename, quoting these rules from memory, or assuming "I already know the
conventions" does not count and will produce non-conforming code. If you have not read
both this session, stop and read them now — this is the first step of every code task
here, not optional context.

---

## 1. The gate — never weaken it

`npm run verify` is the single gate. It runs, in order:
`format:check → lint → typecheck → deadcode → test → dupes → scan:secrets → audit:deps → e2e`.
It runs on every commit (pre-commit hook via husky/lint-staged) and in CI.

- **Never disable, downgrade, narrow, baseline-away, or mock-out a check to make
  progress.** Fix the code so the check passes. "It's only local/dev" is not a
  reason to relax it — the same gate runs identically in dev, pre-commit, and CI.
- **No inline suppressions** to pass a check: no `biome-ignore`, `eslint-disable`,
  `@ts-ignore`, `@ts-expect-error`, or `jscpd:ignore`. Fix the root cause. If you
  reach for one, you're solving the wrong problem.
- Never commit with `--no-verify` unless the user explicitly asks.

## 2. Build / typecheck gotchas

- **`tsc --noEmit` is a no-op here.** This is a TypeScript *project-references*
  repo (`tsconfig.json` → `tsconfig.app.json` + `tsconfig.node.json`). The real
  typecheck is **`tsc -b`** (or `tsc -b --force` to bust the stale `.tsbuildinfo`
  cache). `npm run typecheck` / `verify` already use `tsc -b`.
- Dev server runs on **port 5180** (`npm run dev`), not Vite's default 5173.
- Stack: React 18 + Vite 8 + Tailwind v4 + HeroUI v2 + Zustand 5 + Dexie/Firestore.
  date-fns for all date math. Lucide for icons. dnd-kit for drag-reorder.

## 3. Architecture — feature slices

- **Vertical feature slices, not layer-based folders.** Code lives under
  `src/features/<feature>/` (component + logic + `__tests__/` together). Cross-cutting
  primitives live in `src/core/` (`agent`, `auth`, `firebase`, `lib`, `persistence`,
  `store`, `theme`, `ui`). The app shell is `src/app/`.
- **Zustand root store = composed feature slices.** `Slice<T> = StateCreator<RootState,…>`
  so `get()` returns the full RootState — slices may reach across (e.g. the tasks
  slice reads `get().habits`). Persist through `@/core/store/persist`
  (`savePut`/`saveRemove`), never write storage directly from a component.
- Keep files focused and small. When a file grows unwieldy, split by responsibility.

## 4. UI & layout conventions (strict)

- **HeroUI primitives only** (`@heroui/react`) — migrated off Radix. Don't reintroduce
  Radix or other component libs. Reach for stock HeroUI before hand-rolling.
- **Calm, minimal, stock-HeroUI look**: slate primary, Inter, semantic Tailwind
  classes. No custom "vapor"/neon overrides. One focus per page; nothing in-your-face.
- **Lucide** for all icons (`lucide-react`). No other icon set.
- **Exactly two page widths** — pick one, no others:
  - regular `max-w-3xl` → Today, Habits, Values
  - wide `max-w-6xl` → Calendar, Settings, Analytics
- **Centered modals, never side panels/drawers** for primary flows.
- **Custom pickers only** — never native `<select>`, native date/time inputs, or
  `window.confirm`/`alert`. Build confirmations and pickers from HeroUI.
- **Segmented / either-or choice = `Button`/`ButtonGroup` with `aria-pressed`.**
  Never use `Tabs` as a form toggle.
- **Energy UX is removed** (2026-06-22): no task charge/drain, no value gauge. The
  data-model fields are kept inert and restorable — don't re-add the UI and don't
  "tidy away" the dormant fields.

## 5. Code style

**Read [`docs/style-guide.md`](docs/style-guide.md) and
[`docs/release-process.md`](docs/release-process.md) in full before writing code** (see §0).
The lines below are a reminder, not a substitute for reading them:

- **Minimal comments.** No verbose or narrating comments. Add at most one terse line,
  and only when the *why* is non-obvious. Let names carry meaning.
- Match the surrounding code's idiom, naming, and density.
- TDD where it fits: pure logic (geometry, store slices, date math) gets unit tests
  under the feature's `__tests__/`. Pointer/drag gestures e2e can't drive are verified
  visually with playwright-cli.

## 6. Docs structure & naming (strict)

All docs live under `docs/`. **Never create a `superpowers/` folder.**

| Dir | Holds | Filename convention |
|---|---|---|
| `docs/specs/` | feature specifications | `YYYY-MM-DD-<slug>.md` |
| `docs/plans/` | implementation plans | `YYYY-MM-DD-<slug>.md` |
| `docs/adr/` | architecture decision records | `YYYY-MM-DD-NNNN-<slug>.md` |
| `docs/runs/` | autonomous-run reports | `YYYY-MM-DD-<name>/` |

- **Every spec and plan filename MUST start with an ISO date prefix** (`YYYY-MM-DD-`).
  A spec with no date in its name is a defect — rename it with `git mv`. (Exception:
  `docs/specs/DECISIONS.md`, the standing decisions index.)
- **Spec fidelity to decisions**: transcribe the user's chosen options (e.g. from a
  clarifying question) into the spec **verbatim**. Never silently soften a
  destructive-action guard (e.g. a required typed-"delete" confirmation).

## 7. Connected-platform features are dormant by design

Firebase sync, the Anthropic-powered ⌘K agent, and Google Calendar sync are built
but **gated** behind env vars / stored keys (`firebaseEnabled` / a stored Anthropic
key / `gcalConfigured`). With no config the app runs as a pure local-first Dexie app.
**Don't "fix" the gated-off paths thinking they're broken** — they're waiting on
secrets. Roadmap + plans live in `.claude/docs/` (git-ignored on purpose).

**Data lifecycle (2026-06-22):** signed-out = local demo sandbox; signed-in = strictly
cloud-only (no app data persisted to disk); no upload-on-sign-in. The signed-in paths
are PENDING manual smoke — treat them as unverified.

**Architecture pivot — BUILT on `main`, NOT deployed (2026-07-13):** the repo is now an
**npm-workspaces monorepo** — `apps/web` (the SPA, moved from `src/`), `apps/server`
(Node 24 · Hono · tRPC · Firebase Admin), `packages/shared` (Zod schemas). The signed-in
app is **online-first through `apps/server`**: the client writes via `TrpcAdapter` (behind
the existing `RoutingAdapter` seam), direct client→Firestore writes are gone, and
`firestore.rules` is locked to `write: if false`. Google Calendar sync is server-side
(OAuth + encrypted refresh token + reconcile). All 8 build slices are on `main` and green
(server 130 / web 547 / shared 36 / e2e 89, tested vs the Firestore emulator). **The
signed-out demo still runs standalone on local Dexie.** NOT yet done (needs the user):
the server is **not deployed** (Cloud Run / Secret Manager / Scheduler / WIF need their GCP
project) and **live Google OAuth** needs their client id+secret — so a signed-in session
needs the server running + configured. **Running server tests needs Java 11+** (JDK 21 at
`C:\Users\karam\tools\jdk-21.0.11+10`, `JAVA_HOME` set). See the run report
[`docs/runs/2026-07-13-backend-build/report.md`](docs/runs/2026-07-13-backend-build/report.md),
the spec, and [`docs/adr/2026-07-13-0003-backend-architecture.md`](docs/adr/2026-07-13-0003-backend-architecture.md).

## 8. Anthropic client-side call contract

The browser agent calls Claude with model id **`claude-opus-4-8`** (exact id, no date
suffix) and `dangerouslyAllowBrowser: true`. Do **not** add `budget_tokens`,
`temperature`, `top_p`, or `top_k` — the adaptive-thinking endpoint **400s** on them.
SDK types lag the runtime payload, hence the deliberate cast in `anthropic-agent.ts`.

## 9. Workflow & hygiene

- All tooling is scoped to `src/`. `.env.local` is a gitignored Firebase secret —
  never read it into output or commit it.
- **Commit/push only when the user asks.** Don't auto-commit or auto-push.
- Before any commit, run `git status` and confirm **only intended files** are staged.
- Commit message bodies end with:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- **Scratch/throwaway artifacts** (screenshots, scratch scripts, logs, `.har`) go to
  the OS temp dir (`%TEMP%\claude-scratch\`), **never** the repo. Pass absolute temp
  paths to Playwright screenshots — a bare filename lands in the repo root. Clean up
  before ending a task. After any task, `git status` shows only intended changes.
