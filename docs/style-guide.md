# VEGA Life OS — Style Guide

How to name, comment, and structure code here. Pure code style — the git workflow,
commit format, and release steps live in **[`release-process.md`](release-process.md)**.

`CLAUDE.md` is the agent operating manual (the gate, build gotchas, UI/architecture
rules). Where this conflicts with habit, this file wins; where it conflicts with
`CLAUDE.md`, `CLAUDE.md` wins.

---

## 1. The gate is the standard

`npm run verify` decides whether code is acceptable — format, lint, typecheck, dead code,
tests, duplication, secret scan, dep audit, e2e. Enforcement is layered: pre-commit runs
lint-staged (Biome on staged files) and gitleaks; pre-push runs the gate minus e2e; CI runs
everything, including sharded e2e and SAST. The full local gate is `npm run verify`.

**Never disable, downgrade, narrow, baseline-away, or suppress a check to make progress.**
No `biome-ignore`, `eslint-disable`, `@ts-ignore`, `@ts-expect-error`, `jscpd:ignore`, or
`--no-verify`. A failing check means the code is wrong — fix the code.

## 2. Folders & files

- **Vertical feature slices.** Code lives in `src/features/<feature>/` — component, logic,
  and `__tests__/` together. Cross-cutting primitives live in `src/core/` (`agent`, `auth`,
  `firebase`, `lib`, `persistence`, `store`, `theme`, `ui`). App shell is `src/app/`.
- **One responsibility per file.** Past ~300–400 lines, or when it starts doing two jobs,
  split it. A big file is debt even when it passes the gate.
- **Folders are `kebab-case`/lowercase** (`calendar-sync`).
- **Persist only through `@/core/store/persist`** (`savePut`/`saveRemove`) — never touch
  storage directly from a component.

## 3. File naming

| Kind | Convention | Example |
|---|---|---|
| React component / page | `PascalCase.tsx`, one component per file, filename = component | `HabitEditor.tsx` |
| React hook | `useCamelCase.ts(x)` | `useValueColor.ts` |
| Logic / util / store / types | `kebab-case.ts`; a single word may stay bare-lowercase | `anthropic-agent.ts`, `clock.ts` |
| Public surface of a core module | `index.ts` (barrel) | `core/agent/index.ts` |
| Test | `*.test.ts(x)`, colocated in the slice's `__tests__/` | `features/tasks/__tests__/store.test.ts` |

No `camelCase` or `snake_case` module files. No abbreviations in filenames.

## 4. Naming things — a name should make a comment unnecessary

The test for every name: **could a stranger guess what this is without reading its body?**
If not, the name is wrong — rename it, don't paper over it with a comment. This is the
comment rule (§5) seen from the other side.

**Length: 2–4 words.** Shorter wins *only while it stays unambiguous* — clarity always
beats brevity. `nextUnresolvedTask`, never `t` or `task2`. Single-letter names are banned
except a loop index in trivial math. No abbreviations except the universally-known (`id`,
`url`, `db`).

### Functions — verb first, always

A function *does* something, so its name **starts with a verb**, then what it acts on:
`verbNoun`, `camelCase`.

| Good | Bad | Why |
|---|---|---|
| `toggleTask` | `task` | a bare noun is a value, not an action |
| `healStreak` | `streakFix` | verb leads — not a noun-noun mash |
| `computeAlignment` | `alignment` · `doAlign` | name the real verb, not `do` |
| `ensureUpcomingSlots` | `slots` · `handleSlots` | `handle` is for events only |
| `formatDueDate` | `dueDateString` | describe the action, not the return type |

Pick the verb precisely and use it **consistently** across the codebase:

- `get*` — cheap synchronous accessor; `fetch*` / `load*` — async I/O.
- `compute*` / `derive*` — a pure calculation from inputs.
- `create*` / `build*` — makes a new thing; `update*` / `set*` — mutates; `remove*` / `clear*` — deletes.
- `is*` / `has*` / `should*` / `can*` — returns a boolean (below).
- `handle*` — an event handler, and nothing else.
- `ensure*`, `resolve*`, `sync*`, `normalize*`, `parse*` — when they fit exactly.

### Split a long function, don't annotate it

When a function grows long and one stretch of it needs explaining, that's the signal to
pull that stretch into its own named function. The name does the explaining. Code
documents itself through decomposition, not through a `// now validate the input` label
over a ten-line block and not through one giant function. If you're about to write a
comment that labels a section, extract the section instead and let its name say it —
`validateInput(...)`, `buildSlotList(...)`, `resolveConflicts(...)`.

### Booleans — read as a yes/no question

Prefix with `is` / `has` / `should` / `can` / `did`, so the name *is* the question it
answers: `isScheduled`, `hasActiveStreak`, `canEditHabit`, `shouldBackfill`. Never a bare
adjective (`scheduled`) and never a negation baked in (`isNotReady` → prefer `isReady`).

### Variables — a specific noun phrase

A value is a *thing*: name it with a noun or noun phrase, `camelCase`. Plural for
collections, singular for one — `scheduledTasks`, `activeHabit`, `nextSlotDate`. Banned:
`data`, `arr`, `obj`, `temp`, `val`, `res`, and any single letter outside a loop index.

### Types & interfaces — a noun, PascalCase

A type names a *shape of thing*, so it's a **noun**, never a verb. `PascalCase`, no `I`- or
`T`- prefix.

- Domain shapes: `Task`, `HabitSchedule`, `StreakState`, `CalendarEvent`.
- The result of an operation: `SyncResult`, `HealOutcome` — the noun, not the verb.
- Component props: `<Component>Props` — `HabitEditorProps`.
- A function-type alias names a *role*, so use a noun: `type TokenSource = () =>
  Promise<string>`, not `type GetToken`.
- Unions: a singular type name; members describe the states — `"idle" | "syncing" | "error"`.

### Components, hooks, handlers, constants, store

- **Component:** a `PascalCase` noun — it *is* a thing on screen. `HabitEditor`. Never verb-led.
- **Hook:** `use` + what it returns — `useValueColor`, `useCompactModal`.
- **Event handler:** `handle` + subject + event → `handleTaskClick`; the prop that carries
  it is `on` + event → `onSelect`, `onClose`.
- **True constant:** `UPPER_SNAKE_CASE` for a real module-level constant — `SYNC_WINDOW_DAYS`.
  Config *objects* stay `camelCase`.
- **Store:** a slice is `<feature>Slice`; its actions are verb-first functions like any other.

## 5. Comments — the default is *none*

Names and types carry the meaning. A comment means they didn't, so use it rarely.

**Write a comment only to explain _why_, never _what_** — a non-obvious constraint, a
workaround, a gotcha the next reader would trip on (e.g. "the adaptive-thinking endpoint
400s on `temperature`"). One terse line, max.

Do **not** write:

- Comments that restate the code (`// increment counter`).
- Section-divider or block-label comments. If a block needs a label, extract it into a
  named function (§4) — the name is the label.
- JSDoc on internal functions — reserve it for a genuinely shared public API.
- Commented-out code. Delete it; git remembers.
- `TODO` / `FIXME` / `HACK` on `main`. The tree has **zero** — keep it that way; track work
  in `docs/specs/` instead.

## 6. Imports

Let Biome's `organizeImports` sort them — don't hand-order. Use the `@/` alias across
slices; relative paths only within the same slice.

## 7. Cleanliness (what the gate already watches)

- **Dead code** (Knip): unused files, exports, exported types, duplicate exports, dependencies
  and unlisted deps all fail.
- **Duplication** (jscpd, 2%): copy-pasted logic fails — extract the shared piece into
  `core/lib/` or the slice. AI-generated code clones heavily; watch for it.
- **Complexity** (Biome): currently warn-only, so it does not fail the gate; promoting it to
  an error is a planned ratchet. Untangle a flagged function, don't suppress it.
- **Dormant-by-design code stays.** Firebase sync, the ⌘K agent, GCal sync, and the inert
  energy-model fields are gated, not dead — don't "tidy them away" (`CLAUDE.md §4, §7`).

## 8. UI & architecture

In `CLAUDE.md` (§3 architecture, §4 UI), not duplicated here: HeroUI primitives only,
Lucide icons, two page widths, centered modals, custom pickers, Zustand composed slices.
