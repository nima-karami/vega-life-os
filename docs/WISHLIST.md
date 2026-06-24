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

---

## Bug fixes

_(to be added — user will provide)_
