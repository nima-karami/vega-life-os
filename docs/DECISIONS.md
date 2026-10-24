# Standing decisions

Product and engineering calls that hold across every spec. A spec may not quietly override
one; changing one is a user decision, recorded here with its date. Detail lives in the
linked section of `CLAUDE.md` or the ADR. Item 1 keeps its number because older specs cite
"DECISIONS.md #1". The pre-2026-07 ledger is archived locally (not in git) at
`docs/archive/2026-06-21-minimal-focus-decisions.md`.

1. **i18n is out of scope** (2026-06-21). Single-user app: copy stays inline, no i18n
   library, no central strings module.
2. **Accessibility is a non-goal, but ARIA stays** (2026-08-04). Don't chase a11y defects.
   Keep ARIA attributes: the e2e suite selects by role, and React Aria emits them anyway.
3. **Energy UX is removed** (2026-06-22). No task charge/drain, no value gauge. The data
   fields stay inert and restorable (`CLAUDE.md` §4).
4. **Data lifecycle** (2026-06-22). Signed out = local Dexie demo sandbox; signed in =
   cloud only, nothing persisted to disk, no upload on sign-in (`CLAUDE.md` §7).
5. **Online-first through `apps/server`** (2026-07-13). Signed-in writes go through the
   tRPC server; `firestore.rules` denies all client writes
   ([ADR 0003](adr/2026-07-13-0003-backend-architecture.md)).
6. **Two page widths**: `max-w-3xl` and `max-w-6xl`, nothing else (`CLAUDE.md` §4).
7. **Centered modals, not drawers** — except value, goal and habit, which are routed pages
   (2026-08-07, `CLAUDE.md` §4).
8. **Entity cards are the value's colour, from an 8-hue palette** (2026-08-07). No neutral
   hue in the picker; status reads by glyph and weight (`CLAUDE.md` §4).
9. **Custom pickers only.** No native `<select>`, date/time inputs or `window.confirm`;
   either-or choices are `Button`/`ButtonGroup` with `aria-pressed`, never `Tabs`.
10. **Habit cadence has one source of truth**: `Habit.schedule` (2026-06-26).
11. **Rolling consistency replaces streaks** (2026-10-20). The streak engine was deleted
    (d59fbfb).
12. **Server ships before hosting**, and a release never renames or removes a field an old
    client still sends ([`release-process.md`](release-process.md) §5).
13. **CI skips work a change cannot affect** (2026-10-22): docs-only and web-only scopes
    ([`release-process.md`](release-process.md) §3).
