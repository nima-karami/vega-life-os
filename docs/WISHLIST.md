# Wishlist

Backlog for autonomous build runs. Each item links its spec (and plan, once written).
Status: `spec ready` → buildable now · `needs spec` → run feature-spec first ·
`in progress` · `done`.

> **For the autonomous-build-loop:** items marked `spec ready` route straight to
> planning/implementation. Right-size to the spec's tier (LITE builds straight from
> the spec; FULL gets a plan first). Verify against each spec's acceptance criteria;
> PWA install dialogs and on-device behavior are **manual smoke** (`needs-human-smoke`).

---

## Features

### 1. HeroUI v2 → v3 migration
- **Status:** spec ready
- **Tier:** FULL · **Type:** non-UI (dependency/theming migration) with UI-parity gates
- **Spec:** [docs/specs/heroui-v3-migration.md](specs/heroui-v3-migration.md)
- **Summary:** Port the app from HeroUI v2.8.10 → v3 (major breaking rewrite) before the
  design-system/facade work. React 18→19 pre-slice; remove `HeroUIProvider` + `hero.ts`;
  swap to v3 CSS-variable theming and rewrite the dynamic value-hue accent; migrate the
  `src/core/ui` wrappers, then feature surfaces area-by-area against captured v2
  screenshots. Full migration on a disposable branch.
- **Key constraints:** `main` never left broken (branch-only); no v2 `@heroui` import /
  `HeroUIProvider` / `hero.ts` survives; value-hue accent re-tint preserved; a11y not
  regressed; `classNames`→`className`, `CardBody`→`Card.Content`, collection
  `id`/`textValue`; `npm run verify` green + per-page visual parity. **Do first** — it
  changes the component library, so land it before the UI-touching items below; land or
  stash the in-flight calendar-multiselect work before branching.

### 2. Expanded icon picker (searchable, categorized)
- **Status:** spec ready
- **Tier:** FULL · **Type:** UI
- **Spec:** [docs/specs/2026-06-23-icon-picker-expanded.md](specs/2026-06-23-icon-picker-expanded.md)
- **Summary:** Replace the tiny per-editor icon lists with one shared, searchable,
  category-grouped `IconField` (inline scrollable panel) over a curated ~150–250
  icon catalog behind the existing closed, type-safe `IconName` union. Wired into the
  Value, Goal, and Habit editors. No data migration.
- **Key constraints:** keep the closed/synced union; chrome glyphs never pickable;
  unit test enforces catalog↔glyph completeness; full keyboard + a11y.

### 3. Installable PWA (online-first)
- **Status:** spec ready
- **Tier:** FULL · **Type:** UI
- **Spec:** [docs/specs/2026-06-23-installable-pwa.md](specs/2026-06-23-installable-pwa.md)
- **Summary:** Make the app installable on Android/iOS/desktop via a web manifest +
  generated icons + a service worker (vite-plugin-pwa 1.3.0, Vite 8). Browser-native
  install only; reload-toast update flow. Online-first — offline **data** is out of
  scope.
- **Key constraints:** add firebase.json `no-cache` headers for `/sw.js` +
  `/manifest.webmanifest`; Workbox `navigateFallback` must agree with the SPA
  rewrite; install/Add-to-Home-Screen + SW-update timing are manual on-device smoke.

### 4. Full mobile-phone usability
- **Status:** spec ready
- **Tier:** FULL · **Type:** UI
- **Spec:** [docs/specs/2026-06-23-mobile-responsive-usability.md](specs/2026-06-23-mobile-responsive-usability.md)
- **Summary:** Make every route and dialog fully usable on a phone (320–430px): no
  horizontal overflow, no overlapping elements, ≥44px tap targets, sheet-style
  dialogs that keep actions above the keyboard, single-day calendar, touch drag with
  non-drag fallback, `dvh` height + safe-area insets. **Full pass, not an MVP** — §6
  "Required" is the deliverable.
- **Key constraints:** authored autonomously — **3 flagged decisions in §13**
  (highest `high`: kept command-bar-only nav, did NOT add a bottom nav). UI-touching,
  so **run after the HeroUI v3 migration (#1)**. Automatable: mobile-viewport
  Playwright (no-overflow per route, dialog fits); manual on-device smoke for touch
  drag + keyboard avoidance + safe areas.

### 5. Full-screen journal with a Notion-style markdown editor
- **Status:** spec ready
- **Tier:** FULL · **Type:** UI
- **Spec:** [docs/specs/2026-06-23-journal-rich-editor.md](specs/2026-06-23-journal-rich-editor.md)
- **Summary:** Replace the cramped day-entry modal with a dedicated full-screen page
  (`/journal/:date`), make gratitude fields multiline/auto-grow (no more truncation),
  and turn the journal body into a Notion-style **TipTap v3** editor with a slash menu
  (headings, lists, checkboxes, quote, code, divider, marks, links) stored as
  **Markdown** (no migration; plain-text entries stay valid). Full text blocks, no
  media. **Full build, not MVP.**
- **Key constraints:** headless TipTap styled with HeroUI tokens (no competing UI
  lib); link scheme safety + `rel=noopener`; read-only Markdown sanitized (allowlist);
  autosave debounced + flush-on-leave reusing `upsertDayEntry`/empty-discard; editor
  reused in `ReflectionStep`; gate allowlists the route. UI-touching → **run after
  HeroUI v3 (#1)**; coordinate with mobile (#4).

---

## Bug fixes

### Habit duration stepper — off-grid math + unrealistic 1-min floor
- **Status:** done (local, uncommitted) — fixed this session
- **What:** Stepping a habit's duration 30→15→1 then up gave 16 and stayed stuck off
  the 15-min grid forever. Root cause: `DurationStepper` did raw `value ± step` then
  clamped to an off-grid `min` (1). Fixed with a pure snap-to-grid `stepValue`
  helper (`src/core/ui/stepper.ts` + unit test). Also raised the realistic floor:
  habit duration min/step now 15 (control + `validateDraft` + test) — a 1-minute
  calendar block isn't realistic.
