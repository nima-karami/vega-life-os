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
`format:check → lint → typecheck → deadcode → check:lockfile → check:suppressions → test →
dupes → scan:secrets → audit:deps → e2e`.
Enforcement is layered: **pre-commit** runs lint-staged (Biome on staged files) +
gitleaks only; **pre-push** runs format, lint, typecheck, deadcode, test and dupes (no e2e,
no lockfile/suppression checks, no audits — `.husky/pre-push`); **CI on push** runs everything
except e2e, plus SAST, in one `checks` job — skipping the server suite for a web- or docs-only
change (user decision 2026-10-22); **e2e runs at release**, in `release.yml` before any deploy
and locally in the laptop release guard (user decision 2026-10-23, to save Actions minutes;
`docs/release-process.md §3`). Run the full gate locally with `npm run verify`.

- **Never disable, downgrade, narrow, baseline-away, or mock-out a check to make
  progress.** Fix the code so the check passes. "It's only local/dev" is not a
  reason to relax it — the same checks run in every layer; the hooks just run a subset.
- **No inline suppressions** to pass a check: no `biome-ignore`, `eslint-disable`,
  `@ts-ignore`, `@ts-expect-error`, or `jscpd:ignore`. Fix the root cause. If you
  reach for one, you're solving the wrong problem.
- Never commit with `--no-verify` unless the user explicitly asks.

## 2. Build / typecheck gotchas

- **`tsc --noEmit` is a no-op here.** This is a TypeScript *project-references*
  repo (root `tsconfig.json` → `apps/web` (→ `tsconfig.app.json` + `tsconfig.node.json`),
  `apps/server`, `packages/shared`). The real
  typecheck is **`tsc -b`** (or `tsc -b --force` to bust the stale `.tsbuildinfo`
  cache). `npm run typecheck` / `verify` already use `tsc -b`.
- **Unit tests are node by default.** `apps/web/vitest.config.ts` is `environment: "node"` with
  `include: ["src/**/*.test.ts"]` — `.tsx` test files are never collected. A `.test.ts` file
  that needs a DOM opts in with a first-line `// @vitest-environment jsdom` (a few do: the
  journal editor, `useStatementImport`). Rendered UI is still proved in e2e, not in a unit test.
- Dev server runs on **port 5180** (`npm run dev`), not Vite's default 5173.
- Stack: **React 19 + Vite 8 + Tailwind v4 + HeroUI v3 + react-router 8 + Zustand 5 +
  Dexie/Firestore**. date-fns for all date math. Lucide for icons. dnd-kit for drag-reorder.
  (Corrected 2026-08-11 — this line said React 18 / HeroUI v2 long after the v3 migration
  landed, and agents were writing v2-shaped code against a v3 install. Check
  `apps/web/package.json` before trusting any version written down anywhere.)
- **HeroUI v3 idioms differ from v2**, which is the usual source of code that will not
  compile: `onPress` not `onClick` on HeroUI controls; `Checkbox` composes
  `Checkbox.Content > Checkbox.Control > Checkbox.Indicator`; `ListBox` is react-aria-components'
  ListBox (`selectionMode` / `selectedKeys` / `disabledKeys` / `onSelectionChange`);
  `Popover.Trigger` **is** the button, so its content must never be a nested `<button>`.

## 3. Architecture — feature slices

- **Vertical feature slices, not layer-based folders.** Code lives under
  `apps/web/src/features/<feature>/` (component + logic + `__tests__/` together).
  Cross-cutting primitives live in `apps/web/src/core/` (`agent`, `auth`, `firebase`, `lib`,
  `persistence`, `store`, `theme`, `ui`). The app shell is `apps/web/src/app/`.
- **Zustand root store = composed feature slices.** `Slice<T> = StateCreator<RootState,…>`
  so `get()` returns the full RootState — slices may reach across (e.g. the tasks
  slice reads `get().habits`). Persist through `@/core/store/persist`
  (`savePut`/`saveRemove`), never write storage directly from a component.
- Keep files focused and small. When a file grows unwieldy, split by responsibility.
- The server mirrors this: `apps/server/src/features/<feature>/` and `apps/server/src/core/`.
  Schemas shared by both sides live in `packages/shared`.

## 4. UI & layout conventions (strict)

- **HeroUI primitives only** (`@heroui/react`) — migrated off Radix. Don't reintroduce
  Radix or other component libs. Reach for stock HeroUI before hand-rolling.
- **Calm, minimal, stock-HeroUI look**: slate primary, Inter, semantic Tailwind
  classes. No custom "vapor"/neon overrides. One focus per page; nothing in-your-face.
- **Lucide** for all icons (`lucide-react`). No other icon set.
- **Exactly two page widths** — pick one, no others:
  - regular `max-w-3xl` → Today, Habits, Values
  - wide `max-w-6xl` → Calendar, Settings, Analytics
- **Centered modals, never side panels/drawers** for primary flows. **Exception
  (2026-08-07):** a value, a goal and a habit are each a **routed page**
  (`/values/:id`, `/goals/:id`, `/habits/:id`), not a dialog — they carry a full screen
  of content a sheet would have to scroll. Everything else stays a centered modal.
- **Entity cards are the value's colour** (2026-08-07). Values, goals and habits render
  through one builder, `EntityCard` in `core/ui` — the value's deepened hue floods the
  whole card and everything on it is white or white-alpha. The measure zone is fixed at
  26px (goal → progress track, habit → the week, value → empty) so a mixed list keeps one
  rhythm. Status separates by **glyph and weight**, never by a semantic colour: nothing
  reads at contrast on a saturated fill.
- **Value palette is 8 hues** — blue, green, rust, violet, teal, magenta, amber, olive.
  Each has a swatch (text/dots) and a deepened card fill (`getValueCardFill`). Slate and
  ink were retired when the card became the colour; `RETIRED_HUE_REPLACEMENT` + data
  migration v3 move stored values off them. Don't re-add a neutral to the picker.
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
| `docs/archive/` | frozen docs, kept for history | `YYYY-MM-DD-<slug>.md` |

The index is [`docs/README.md`](docs/README.md).

- **Every spec and plan filename MUST start with an ISO date prefix** (`YYYY-MM-DD-`).
  A spec with no date in its name is a defect — rename it with `git mv`. (Exception:
  `docs/specs/DECISIONS.md`, the standing decisions index.)
- **Spec fidelity to decisions**: transcribe the user's chosen options (e.g. from a
  clarifying question) into the spec **verbatim**. Never silently soften a
  destructive-action guard (e.g. a required typed-"delete" confirmation).

## 7. Connected-platform features are dormant by design

Firebase sign-in and sync, the Anthropic-powered ⌘K agent, and Google Calendar sync are
**gated**: on the `VITE_FIREBASE_*` env vars (`firebaseEnabled`), a stored Anthropic key,
and the user connecting a Google account in Settings. With no config the app runs as a
pure local-first Dexie app. **Don't "fix" the gated-off paths thinking they're broken** —
they're waiting on config. Plans are tracked in `docs/plans/`; `.claude/docs/` (git-ignored)
holds only the old connected-platform roadmap.

**Data lifecycle (2026-06-22):** signed-out = local demo sandbox; signed-in = strictly
cloud-only (no app data persisted to disk); no upload-on-sign-in.

**Monorepo, online-first (2026-07-13, live):** npm workspaces — `apps/web` (the SPA),
`apps/server` (Node 24 · Hono · tRPC · Firebase Admin, deployed to Cloud Run as
`vega-server`), `packages/shared` (Zod schemas). The signed-in app is **online-first
through `apps/server`**: the client writes via `TrpcAdapter` (behind the `RoutingAdapter`
seam), there are no direct client→Firestore writes, and `firestore.rules` is locked to
`write: if false`. Google Calendar sync is server-side (OAuth + encrypted refresh token +
reconcile; secrets in Secret Manager). **The signed-out demo runs standalone on local
Dexie.** A local signed-in session needs the server running and configured
(`apps/server/.env.example`). **Running server tests needs JDK 21 on `PATH`, not
just `JAVA_HOME`** — the tests boot the Firestore emulator through firebase-tools, and if
`java` resolves to an older JRE the whole server suite fails misleadingly (every calendar
test at once, with errors that look like product bugs). Prepend it for the session:
`export PATH="/c/Users/karam/tools/jdk-21.0.11+10/bin:$PATH"` (verify with `java -version`).
See the run report
[`docs/runs/2026-07-13-backend-build/report.md`](docs/runs/2026-07-13-backend-build/report.md),
the spec, and [`docs/adr/2026-07-13-0003-backend-architecture.md`](docs/adr/2026-07-13-0003-backend-architecture.md).

## 8. Anthropic client-side call contract

The browser agent calls Claude with model id **`claude-opus-4-8`** (exact id, no date
suffix) and `dangerouslyAllowBrowser: true`. Do **not** add `budget_tokens`,
`temperature`, `top_p`, or `top_k` — the adaptive-thinking endpoint **400s** on them.
SDK types lag the runtime payload, hence the deliberate cast in `anthropic-agent.ts`.

## 9. Workflow & hygiene

- Tooling covers the whole monorepo (`apps/*`, `packages/*`, `scripts/`). `.env.local` is
  a gitignored Firebase secret — never read it into output or commit it.
- **Commit/push only when the user asks.** Don't auto-commit or auto-push.
- Before any commit, run `git status` and confirm **only intended files** are staged.
- Commit message bodies end with a `Co-Authored-By:` trailer naming **the model that
  actually did the work** — don't copy a stale model name from an older commit:
  `Co-Authored-By: Claude <model name> <noreply@anthropic.com>`
- Commit types: `feat` · `fix` · `perf` · `refactor` · `test` · `docs` · `build` · `ci` ·
  `chore` · `revert` (format in `docs/release-process.md` §2).
- **Releases & versioning:** ship with `npm run release` (target-aware: deploys only what
  changed since live, server first). A release is a CalVer git tag `vYYYY.M.N` plus a GitHub
  Release; `CHANGELOG.md` is regenerated from them by `npm run changelog`. **Never bump
  `package.json` versions** — the tag is the version. Details: `docs/release-process.md`.
- **Scratch/throwaway artifacts** (screenshots, scratch scripts, logs, `.har`) go to
  the OS temp dir (`%TEMP%\claude-scratch\`), **never** the repo. Pass absolute temp
  paths to Playwright screenshots — a bare filename lands in the repo root. Clean up
  before ending a task. After any task, `git status` shows only intended changes.
