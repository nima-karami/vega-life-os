# Resolved decisions — minimal redesign

Authoritative answers to the cross-cutting `## Decisions Needed` flags in the slice
specs. **This ledger overrides any conflicting per-spec default.** Read it before
implementing any slice.

Branch: `redesign/minimal-focus`. Build order: slice 0 (foundation) first, then
slices 1–5 (any order; each depends only on slice 0).

## Product decisions (user-confirmed 2026-06-21)

1. **i18n — OUT OF SCOPE for all slices.** VEGA is a single-user personal app.
   Keep UI copy inline; do **not** add an i18n library and do **not** introduce a
   centralized strings module. Ignore the i18n sections/flags in every spec
   (slice 1 §, slice 3, slice 5 D7, and any other). Accessibility (a11y) is still
   in scope — only translation-readiness is dropped.

2. **Calendar — Google Calendar sync IS IN SCOPE for v1** (slice 4, overrides
   D1's "out of scope" default). The new `/calendar` view surfaces the existing
   two-way `calendar-sync` feature (re-skinned to vapor/HeroUI), reusing its
   existing logic and Settings/boot wiring. See `04-calendar-view.md` for the
   folded-in requirements.

3. **Calendar backlog — Collapsible "Unscheduled" rail** (slice 4 D2, confirms
   default). Undated tasks (`date = null`) appear in a collapsible side rail that
   can be dragged onto days; they are not shown inside the timed grid.

4. **Foundation contracts — single source of truth.** `valueColor` / `taskLineage`
   ship as BOTH a pure core function and a thin store-bound hook (slice 0 §3).
   View slices consume the real exports; no local shims once slice 0 is merged
   (build order guarantees slice 0 lands first).

## Remaining `[high]` flags (handled by build order / safe defaults — no human input needed)

- View slices depend on slice 0 contracts that don't exist yet → resolved by build
  order (slice 0 first). No shims needed.
- Playwright smoke (`e2e/smoke.spec.ts`) asserts the old nav + removed routes →
  slice 0 rewrites it to assert boot-to-`/today`, omni trigger visible, the 5
  routes render, and a removed route 404s.
- Muted-text contrast (`#8A93A0` on white) → slice 0 theme owner ensures small/body
  text meets WCAG 4.5:1 (use a darker muted token for small text if needed).
