# VEGA · Life OS — Handoff

Built overnight from the Claude Design "cockpit HUD" handoff. This is a real,
running, local-first app — not a prototype. Everything below is wired and verified.

## What's built

All 8 spine views (Cockpit, Map, Calendar, Board, Values & Goals, Habits,
Analytics, Library) with full create / edit / complete / persist, a ⌘K agent
command bar, and a 6-variant `/lab` design gallery. Data persists in IndexedDB
and seeds 3+ weeks of believable history anchored to the current week, so the
app always looks "live" whenever you open it.

## Architecture (feature-sliced)

```
src/
  app/            RootBoot (boot/theme/⌘K), AppShell chrome, router, TopBar, NavRow
  core/
    theme/        Tailwind v4 tokens (paper + void themes), JS token mirror
    persistence/  PersistenceAdapter iface · DexieAdapter (IndexedDB) · seed
    store/        Zustand root composed from feature slices
    agent/        Agent iface · LocalIntentAgent (NL parser) · when.ts date parsing
    ui/           HUD primitives (Panel, Gauge, DotMeter, Radar, Sparkline, Stars…)
    lib/          align, date, id, icon-names
  features/       values · goals · habits · tasks · calendar · board · cockpit ·
                  analytics · library · map · valuesgoals · lab
```

Each feature owns `model.ts` (types), `store.ts` (slice), `selectors.ts`,
components, and a public `index.ts` barrel. Cross-feature reads go through barrels.

The data spine: **Value → Goal → Habit → Task**. `Task` is the atom
(habit-instance or one-off; undated one-offs = backlog). Alignment is derived in
`core/lib/align.ts`.

## Deferred seams (need your accounts/keys — non-blocking, designed-for)

1. **Live AI command bar.** Today the ⌘K bar uses `core/agent/LocalIntentAgent`
   (deterministic). It implements the `Agent` interface. To go live, add an
   `AnthropicAgent implements Agent` that calls the API with an `ANTHROPIC_API_KEY`
   from `.env`, and swap the export in `core/agent/local-agent.ts` / a factory.
   The command bar and terminal both consume `agent.suggest()` so nothing else changes.

2. **Cross-device sync.** Persistence is behind `core/persistence/adapter.ts`
   (`PersistenceAdapter`). `DexieAdapter` is local. Add a `FirebaseAdapter` /
   `SupabaseAdapter` with the same interface and swap the `persistence` export —
   feature code is untouched.

3. **Google Calendar import.** No external calendar yet. Add an importer that maps
   external events to `Task`s (or a parallel read-only layer) and an OAuth flow.

## Known follow-ups (nice-to-haves, not blockers)

- Calendar blocks are click-to-open; drag-to-reschedule on the grid is not wired
  yet (Board drag works). `moveTask` already exists in the tasks store.
- Board "To do" column lists overdue instances oldest-first — consider an
  "overdue" sub-group.
- Operator name ("Avery Quinn") is a constant in `CockpitPage` — a Settings page
  would make it (and theme/seed) user-editable.
- Bundle: main app is ~190KB gzip; three.js is code-split into the lab routes.

## Reset / demo

⌘K → "Reset demo data" reseeds. `useStore.getState().reseed()` does the same in code.
