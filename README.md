# VEGA · Life OS

A personal command center for your life — a local-first dashboard that tracks
**values, goals, habits, and tasks**, with a calendar, real analytics, a
library (books / film / vocabulary), an always-present ⌘K command bar, and a
`/lab` of wildly different visual takes on the same data.

Monochrome "cockpit HUD" aesthetic. Runs entirely in the browser; your data
lives in IndexedDB on your machine. No account, no server, no keys required.

```bash
npm install
npm run dev      # http://localhost:5180
```

`npm run build` for a production bundle, `npm run preview` to serve it,
`npm run typecheck` (or `tsc -b`) to type-check.

## The core idea

Everything ladders up to a **value**. Alignment is *derived*, not assigned:

| Ladders up to… | Alignment    | Measured by   |
| -------------- | ------------ | ------------- |
| a Goal         | Goal work    | progress      |
| a Value only   | Upkeep       | consistency   |
| nothing        | Errand       | just doing it |

## Views

- **Cockpit** — today's queue, values, goals, habit streaks, radar, follow-through.
- **Map** — "your life, by value": values as orbital centers, goals/habits orbiting; energy → brightness; neglected values flagged.
- **Calendar** — week time-grid, drag-friendly blocks, focus filter, "generate week".
- **Board** — kanban (Backlog / To-do / Doing / Done) with drag between columns.
- **Values & Goals** — the "why" tree; checkable subgoals, pace vs. progress.
- **Habits** — recurrence editor, streaks, rates, 28-day heatmaps.
- **Analytics** — follow-through, weekly trend, daily completion, value balance, goal pace, habit consistency.
- **Library** — Books (shelf + progress + rating), Film (watchlist + rating), Vocabulary (Leitner spaced repetition).
- **Review** — weekly mirror: completion + value-balance + habit rollups, wins/slipped, and guided reflection journaling (saved per week).
- **Settings** — editable operator identity, theme + accent, JSON backup/restore.
- **⌘K command bar** — natural-language add/complete/skip/plan/library + on-the-fly "generated views".
- **/lab** — Galaxy (3D), Globe (3D), Constellation (2D), Terminal (live CLI), Blueprint (technical drawing).

## Stack

Vite · React 18 · TypeScript · Tailwind v4 · Zustand · Dexie (IndexedDB) ·
react-three-fiber + three · framer-motion · cmdk · date-fns.

Feature-sliced architecture (`src/features/<name>/`), cross-cutting concerns in
`src/core/`. See **HANDOFF.md** for architecture and the deferred cloud seams.
