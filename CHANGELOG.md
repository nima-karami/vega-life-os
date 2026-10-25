# Changelog

Every production release of VEGA Life OS, newest first. Versions are CalVer `vYYYY.M.N`, the
Nth release of that month ([ADR 0005](docs/adr/2026-10-22-0005-calendar-versioning.md)).

The GitHub Releases are the record; this file mirrors them. Regenerate it with
`npm run changelog` rather than editing it by hand.

## Unreleased

Whatever is on `main` past the newest release below.

## [v2026.10.6](https://github.com/nima-karami/vega-life-os/releases/tag/v2026.10.6) - 2026-10-25

2 commits since `v2026.10.5`.

### Fixes

- **boot:** keep the splash hand-off from growing the document (868c498)

### Documentation

- regenerate changelog for v2026.10.5 (53bfe55)

### Deploy

- Server: skipped (none of 6 files changed since 1b0f0c5 affect it)
- Hosting: shipped, build `868c498`
- Schema hash: `e62700d3b746`
- Commit: `868c498`
- Run: https://github.com/nima-karami/vega-life-os/actions/runs/40159488969

## [v2026.10.5](https://github.com/nima-karami/vega-life-os/releases/tag/v2026.10.5) - 2026-10-25

9 commits since `v2026.10.4`.

### Fixes

- **release:** pin the gated sha across the local e2e run (7027c14)

### Documentation

- **changelog:** record v2026.10.4 (961695f)
- keep specs, plans, run reports and archive local-only (5abe27f)
- point cited commits at the rewritten history (1b0f0c5)

### Tests

- **today:** read the vote card's own stored row, not the first title match (cdcf850)

### Build

- **deps:** bump serialize-javascript to 7.1.4 (5e47882)
- **deps:** Bump the github-actions group across 1 directory with 7 updates (#1) (001559e)

### CI

- run e2e at release instead of on every push (fc1702a)
- run release e2e in 2 fail-fast shards with 2 workers (c3df7fe)

### Deploy

- Server: shipped, revision `vega-server-00043-fik`
- Hosting: shipped, build `1b0f0c5`
- Schema hash: `e62700d3b746`
- Commit: `1b0f0c5`
- Run: https://github.com/nima-karami/vega-life-os/actions/runs/40149639148

## [v2026.10.4](https://github.com/nima-karami/vega-life-os/releases/tag/v2026.10.4) - 2026-10-24

4 commits since `v2026.10.3`.

### Fixes

- **app:** reload once on a stale lazy chunk; start auth sync at entry (ffe53e1)
- **store:** fail the account load when the Firestore chunk is missing (fadea12)

### Performance

- **app:** lazy-load routes and gated SDKs to halve cold-boot JS (467946c)

### Documentation

- **changelog:** record v2026.10.3 (4cdffce)

### Deploy

- Server: skipped (none of 121 files changed since 7aa4836 affect it)
- Hosting: shipped, build `fadea12`
- Schema hash: `e62700d3b746`
- Commit: `fadea12`

## [v2026.10.3](https://github.com/nima-karami/vega-life-os/releases/tag/v2026.10.3) - 2026-10-24

11 commits since `v2026.10.2`.

### Features

- **gratitude:** carry the written lines into Today's entry pill (67d29bf)
- **goals:** seal the header disc when a goal is marked done (cc664b5)
- **motion:** carry the card's disc into its page, cut the route fade to 290ms (113d102)
- **boot:** stroke-mark boot splash with a "Live your values" dwell (fa19954)

### Fixes

- **goals:** let the status chip settle to its own width after a seal (5ce5513)
- **gratitude:** keep the carry safe across midnight, past days and syncs (7c1e834)
- **motion:** only morph onto a real entity card, land on the disc's own radius (4b0dc15)
- **goals:** land a sealed goal's card morph on its filled disc (dc93ee3)
- **boot:** never leave the app stuck behind the boot splash (1bdbabb)

### Documentation

- **changelog:** record v2026.10.2 (c20eaa0)

### Tests

- **boot:** allow for dropped frames when timing the tagline dwell (ee96f23)

### Deploy

- Server: skipped (none of 100 files changed since 7aa4836 affect it)
- Hosting: shipped, build `ee96f23`
- Schema hash: `e62700d3b746`
- Commit: `ee96f23`

## [v2026.10.2](https://github.com/nima-karami/vega-life-os/releases/tag/v2026.10.2) - 2026-10-24

58 commits since `v2026.10.1`.

### Fixes

- **sync:** refetch again after a refetch that skipped or lost data (57739d8)
- **sync:** type loaded rows honestly so the card migration survives the strip (c616f5a)
- **calendar-sync:** keep the quiet gate honest about channels, races and mirror growth (20d1a2c)
- **brainwrite:** stop the deck re-extending forever once the pool empties (62d5a1e)
- **cards:** persist the column width a keyboard resize step lands on (d9b11be)
- **brainwrite:** keep a correctly graded due card mounted through its fly-off (a2f7880)
- **cards:** land Back on the row it left, whatever the row heights (2a1e82d)
- **cards:** keep gallery flips and row heights honest under windowing (bd44fd1)
- **cards:** give the stand-in chip the trigger's own focus ring (f75aa63)
- **habits:** show this week's strip on a Monday west of UTC (a12b3e4)
- **habits:** recompute card, page and report scores when the day turns (b9380b3)
- **journal:** keep the journal newest-first when an entry is edited or restored (9a7d522)
- **analytics:** recompute the charts and the back-to-it nudge when the day turns (8424318)
- **persistence:** forget the cached dirty flag when another tab writes it (b0e8c96)
- **journal:** give each day its own editor instance (775947f)
- **journal:** let a restored entry win its date again (3705296)
- **cards:** paint a filter with its rows, undo outside render, settle menus in one pass (5d7f0eb)
- **sync:** boot against a server that predates loadSnapshot (441cc32)

### Performance

- **calendar-sync:** read once per reconcile and short-circuit echoes (71030d7)
- **cards,brainwrite:** plan the deck in O(N log N) and window its slots (8ec797c)
- **sync:** stop refetching the account after a tab's own writes (72a65ef)
- **server:** gzip tRPC responses over 1 KB (4f22108)
- **server:** one transaction attempt per counter bump; never buffer a stream (392351d)
- **cards:** window the manager lists and make each row cheap (68a258c)
- **habits:** walk only the asked-for window of habit slots (430f999)
- **calendar:** render only the dragged chip's day on each pointermove (30c9966)
- **calendar:** swap googleapis for `@googleapis/calendar` (977decd)
- **journal:** serialize the editor document only when a save lands (3bc1d69)
- **store:** batch habit runway, bulk task actions and cascades (3282a22)
- **persistence:** migrate only the rows the transform changed (d4f2ca3)
- **journal:** page the entries list and defer its search (3a15f9e)
- **app:** cut per-save and per-render work in five hot spots (2f48e2b)
- **sync:** load the signed-in boot in parallel, version inside the snapshot (f3cb4f9)

### Refactoring

- **calendar:** share the grid and all-day row rules with the day index (00310d6)
- **tasks:** move the habit runway planner into runway.ts (7ccfc2e)
- **analytics,calendar:** review nits on naming and the goal clock (4dac89b)

### Documentation

- **changelog:** record v2026.10.1 (705aea9)
- **release,calendar:** document the bundled image and cpu-boost (39d4288)
- **store:** note that one rejected row fails a whole bulk put (05582eb)

### Tests

- **calendar-sync:** assert reconcile read/write budgets against the emulator (dcaa9f7)
- **cards:** give the planner perf budgets CI headroom (29ecf96)
- **habits:** pin every slot-walk output before optimizing it (00e33a7)
- **cards:** prove the chip hands focus back and a turned tile stays turned (0c58434)
- **habits:** bound the slot walk by work done, not wall-clock time (1732458)
- **tasks:** pin habit instance generation before batching it (299e979)
- **data:** prove bulk task writes keep per-row parity (b8a3378)
- **server:** drive the sync-lock lease clock and heartbeat by hand (ee21480)
- **store:** drop the any-cast suppressions from the slice harnesses (ed5712c)
- **store:** drive slice tests through one typed harness (fa92733)
- **data:** assert the bulk reorder by id, not sorted orders (dbdaeba)
- **server:** cover the production sync-lock heartbeat (7e611f9)

### Build

- **perf:** add the cards benchmark as npm run perf:cards (3440dbe)
- **perf:** declare `@playwright/test` at the root instead of a knip ignore (5d69016)
- **server:** run a bundled dist/index.js in the image (0c7daff)
- **deploy:** deploy vega-server with startup CPU boost (261b608)
- **server:** ignore nested installs in the image context, caret-pin calendar (dca302a)

### CI

- **server:** smoke the bundled server on the server-scoped path (e2bb2ef)

### Chores

- **gate:** shrink the suppression allowlist by the five store-test casts (cb58add)

### Deploy

- Server: shipped, revision `vega-server-00040-qip`
- Hosting: shipped, build `7aa4836`
- Schema hash: `e62700d3b746`
- Commit: `7aa4836`

## [v2026.10.1](https://github.com/nima-karami/vega-life-os/releases/tag/v2026.10.1) - 2026-10-24

First versioned release. Earlier history: the git log.

### Deploy

- Server: shipped, revision `vega-server-00037-max`
- Hosting: shipped, build `0e94962`
- Schema hash: `e62700d3b746`
- Commit: `0e94962`

## Before v2026.10.1

Earlier releases were not versioned. What shipped, and when, is in the git log.
