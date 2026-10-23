# Changelog

Every production release of VEGA Life OS, newest first. Versions are CalVer `vYYYY.M.N`, the
Nth release of that month ([ADR 0005](docs/adr/2026-10-22-0005-calendar-versioning.md)).

The GitHub Releases are the record; this file mirrors them. Regenerate it with
`npm run changelog` rather than editing it by hand.

## Unreleased

Whatever is on `main` past the newest release below.

## [v2026.10.4](https://github.com/nima-karami/vega-life-os/releases/tag/v2026.10.4) - 2026-10-23

4 commits since `v2026.10.3`.

### Fixes

- **app:** reload once on a stale lazy chunk; start auth sync at entry (f623aab)
- **store:** fail the account load when the Firestore chunk is missing (8460b27)

### Performance

- **app:** lazy-load routes and gated SDKs to halve cold-boot JS (f46566b)

### Documentation

- **changelog:** record v2026.10.3 (6c5081a)

### Deploy

- Server: skipped (none of 121 files changed since 26332e8 affect it)
- Hosting: shipped, build `8460b27`
- Schema hash: `e62700d3b746`
- Commit: `8460b27`

## [v2026.10.3](https://github.com/nima-karami/vega-life-os/releases/tag/v2026.10.3) - 2026-10-23

11 commits since `v2026.10.2`.

### Features

- **gratitude:** carry the written lines into Today's entry pill (de108c3)
- **goals:** seal the header disc when a goal is marked done (45269d6)
- **motion:** carry the card's disc into its page, cut the route fade to 290ms (fd9ab0e)
- **boot:** stroke-mark boot splash with a "Live your values" dwell (51018f2)

### Fixes

- **goals:** let the status chip settle to its own width after a seal (b21de05)
- **gratitude:** keep the carry safe across midnight, past days and syncs (60aa906)
- **motion:** only morph onto a real entity card, land on the disc's own radius (be870a4)
- **goals:** land a sealed goal's card morph on its filled disc (0e2cefd)
- **boot:** never leave the app stuck behind the boot splash (63ffd4b)

### Documentation

- **changelog:** record v2026.10.2 (0ac6931)

### Tests

- **boot:** allow for dropped frames when timing the tagline dwell (a68daf3)

### Deploy

- Server: skipped (none of 100 files changed since 26332e8 affect it)
- Hosting: shipped, build `a68daf3`
- Schema hash: `e62700d3b746`
- Commit: `a68daf3`
- Run: https://github.com/nima-karami/vega-life-os/actions/runs/40020462487

## [v2026.10.2](https://github.com/nima-karami/vega-life-os/releases/tag/v2026.10.2) - 2026-10-23

58 commits since `v2026.10.1`.

### Fixes

- **sync:** refetch again after a refetch that skipped or lost data (421186d)
- **sync:** type loaded rows honestly so the card migration survives the strip (c9995b4)
- **calendar-sync:** keep the quiet gate honest about channels, races and mirror growth (3a33c66)
- **brainwrite:** stop the deck re-extending forever once the pool empties (bf650df)
- **cards:** persist the column width a keyboard resize step lands on (c0da0d5)
- **brainwrite:** keep a correctly graded due card mounted through its fly-off (1e423f3)
- **cards:** land Back on the row it left, whatever the row heights (3cea421)
- **cards:** keep gallery flips and row heights honest under windowing (0e84278)
- **cards:** give the stand-in chip the trigger's own focus ring (6198e64)
- **habits:** show this week's strip on a Monday west of UTC (a17b98b)
- **habits:** recompute card, page and report scores when the day turns (40f28e8)
- **journal:** keep the journal newest-first when an entry is edited or restored (312784c)
- **analytics:** recompute the charts and the back-to-it nudge when the day turns (ad73900)
- **persistence:** forget the cached dirty flag when another tab writes it (47624c4)
- **journal:** give each day its own editor instance (28e64dd)
- **journal:** let a restored entry win its date again (9da1035)
- **cards:** paint a filter with its rows, undo outside render, settle menus in one pass (1ba8520)
- **sync:** boot against a server that predates loadSnapshot (3304f72)

### Performance

- **calendar-sync:** read once per reconcile and short-circuit echoes (fe3fd32)
- **cards,brainwrite:** plan the deck in O(N log N) and window its slots (b6d7c82)
- **sync:** stop refetching the account after a tab's own writes (83099c7)
- **server:** gzip tRPC responses over 1 KB (5d0f354)
- **server:** one transaction attempt per counter bump; never buffer a stream (e989b59)
- **cards:** window the manager lists and make each row cheap (24bb6e7)
- **habits:** walk only the asked-for window of habit slots (5409fa4)
- **calendar:** render only the dragged chip's day on each pointermove (3db16f1)
- **calendar:** swap googleapis for `@googleapis/calendar` (469f90d)
- **journal:** serialize the editor document only when a save lands (1a5f3d2)
- **store:** batch habit runway, bulk task actions and cascades (6168652)
- **persistence:** migrate only the rows the transform changed (bae9990)
- **journal:** page the entries list and defer its search (953c08c)
- **app:** cut per-save and per-render work in five hot spots (d3225e6)
- **sync:** load the signed-in boot in parallel, version inside the snapshot (e4c4882)

### Refactoring

- **calendar:** share the grid and all-day row rules with the day index (1478f9c)
- **tasks:** move the habit runway planner into runway.ts (a498efb)
- **analytics,calendar:** review nits on naming and the goal clock (4418f28)

### Documentation

- **changelog:** record v2026.10.1 (e64e5f1)
- **release,calendar:** document the bundled image and cpu-boost (e625557)
- **store:** note that one rejected row fails a whole bulk put (7464f05)

### Tests

- **calendar-sync:** assert reconcile read/write budgets against the emulator (a2c6187)
- **cards:** give the planner perf budgets CI headroom (b51489a)
- **habits:** pin every slot-walk output before optimizing it (75caba9)
- **cards:** prove the chip hands focus back and a turned tile stays turned (5a9fea3)
- **habits:** bound the slot walk by work done, not wall-clock time (39e80f8)
- **tasks:** pin habit instance generation before batching it (5706ecf)
- **data:** prove bulk task writes keep per-row parity (e3c41f9)
- **server:** drive the sync-lock lease clock and heartbeat by hand (02e8837)
- **store:** drop the any-cast suppressions from the slice harnesses (16f3a00)
- **store:** drive slice tests through one typed harness (e5b9f1b)
- **data:** assert the bulk reorder by id, not sorted orders (408910d)
- **server:** cover the production sync-lock heartbeat (531d9ee)

### Build

- **perf:** add the cards benchmark as npm run perf:cards (c660ce8)
- **perf:** declare `@playwright/test` at the root instead of a knip ignore (e0ff023)
- **server:** run a bundled dist/index.js in the image (5861474)
- **deploy:** deploy vega-server with startup CPU boost (651e186)
- **server:** ignore nested installs in the image context, caret-pin calendar (3a89073)

### CI

- **server:** smoke the bundled server on the server-scoped path (1139674)

### Chores

- **gate:** shrink the suppression allowlist by the five store-test casts (8bbb315)

### Deploy

- Server: shipped, revision `vega-server-00040-qip`
- Hosting: shipped, build `26332e8`
- Schema hash: `e62700d3b746`
- Commit: `26332e8`
- Run: https://github.com/nima-karami/vega-life-os/actions/runs/40001963900

## [v2026.10.1](https://github.com/nima-karami/vega-life-os/releases/tag/v2026.10.1) - 2026-10-23

First versioned release. Earlier history: docs/runs/.

### Deploy

- Server: shipped, revision `vega-server-00037-max`
- Hosting: shipped, build `72ace99`
- Schema hash: `e62700d3b746`
- Commit: `72ace99`
- Run: https://github.com/nima-karami/vega-life-os/actions/runs/39895874345

## Before v2026.10.1

Earlier releases were not versioned. What shipped, and when, is written up in the
run reports under [`docs/runs/`](docs/runs/), one folder per run.
