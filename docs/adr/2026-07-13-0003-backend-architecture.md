# ADR 0003 — Backend platform and the move to online-first

Date: 2026-07-13
Status: Accepted

## Context

VEGA has been a local-first Dexie app with an optional, client-only Firestore/
Google-Calendar path. That client-only design has a hard ceiling:

- **Google Calendar sync is broken by construction.** The browser can't safely hold
  a long-lived refresh token, so the access token expires (~hourly) and the re-auth
  triggers a full re-sync that reverts edits made in Vega. No client-only fix exists —
  it needs a server that holds the refresh token and runs an authoritative sync.
- **No validated write path, no safe test story.** The client writes Firestore
  directly, there's one database for everything, and nothing isolates tests/agents
  from real data.
- **The future agent needs a server** to read data and act with scoped tools.

The feature spec (`docs/specs/2026-07-13-backend-platform.md`) settled the *behavior*.
This ADR records the *architecture and stack* decided with the maintainer, and the
reasoning, so it isn't re-argued later.

## Decision

**Topology.** A **separate backend service in the monorepo** (not Next.js, not Cloud
Functions). The Vite/React SPA stays; a new server owns writes, token custody, and the
sync engine. Rejected: a Next.js rewrite (large, risky churn of a polished SPA for no
user-facing gain) and Cloud Functions (forces the paid Blaze plan, keeps Firestore's
weak test story).

**Monorepo.** npm workspaces + `tsc -b` project references:
- `apps/web` — the current SPA
- `apps/server` — the backend
- `packages/shared` — Zod schemas, derived types, the tRPC `AppRouter` type

Rejected: a bare `/server` folder (cross-root type sharing turns hacky and undercuts
tRPC) and pnpm/Turborepo (over-tooling for a solo two-app repo).

**Runtime & framework.** **Node 24 LTS** hosting **Hono** + **tRPC**. Node because
Firebase Admin's gRPC/native path is most battle-tested there and it matches the
frontend toolchain; runtime speed is irrelevant for an I/O-bound single-user backend.
Hono because it's a thin, portable host that lets tRPC own routing. Rejected: Bun/Deno
(Admin SDK compatibility risk for no felt benefit), Fastify/Express (unneeded weight /
dated).

**Data.** Keep **Firestore**, now reached only via the **Admin SDK** behind a **typed
repository per collection**. Environments are **named databases in one project**
(`(default)`=prod / `staging` / `test`), selected by a server env var and asserted at
boot so test/staging cannot touch prod. **Zod-first** modeling in `packages/shared`:
one schema per entity → `z.infer` types → reused for tRPC validation and Firestore
converters (single source, no drift).

**Auth.** Keep **Firebase Auth**. The client attaches its ID token; Hono middleware
verifies it via the Admin SDK → `uid` in the tRPC context; every repository call is
uid-scoped. The client is no longer trusted to write Firestore directly (security
rules lock it off).

**Client data path.** **Online-first, and local-first is retired as a product promise
for the signed-in app.** The signed-in app now requires connectivity; writes are
optimistic with revert-on-failure, no durable offline queue. Implementation reuses the
existing `RoutingAdapter` seam: a new `TrpcAdapter` replaces `FirestoreAdapter` for
signed-in users. **Zustand stays** as the state container — server state is not moved
into TanStack Query (a big rewrite for little single-user gain when the store already
is the cache). The **signed-out demo sandbox stays 100% local (Dexie)**, so
"try before sign-in" survives.

**Calendar sync.** Server-side OAuth **authorization-code** flow; refresh token
encrypted-at-rest in Firestore; OAuth client secret + encryption key in **Secret
Manager**. **Hybrid trigger**: inline best-effort push on write + a GCal watch webhook
(verified by per-channel token/id → `uid` registry) + **Cloud Scheduler** → an
OIDC-authed reconcile endpoint (~5 min) as the durability net. **Field-level
last-write-wins** (whole-event LWW for inbound Google edits, which expose only a single
`updated` timestamp); deletions carried as **tombstones** so a stale mirror never
re-creates a deleted item. No Cloud Tasks queue — the reconcile provides durability at
single-user scale.

**Deploy.** A **Dockerfile image to Cloud Run, per env**, deployed by GitHub Actions
using **Workload Identity Federation** (no long-lived key files). The web app stays on
**Firebase Hosting**.

**Testing.** vitest units + Firestore-emulator integration + Playwright e2e against a
local full stack / staging, all folded into the existing `npm run verify` gate, which
extends to cover the server workspace.

## Consequences

- **The forcing bug is fixable**: silent server-side refresh kills the hourly re-login;
  authoritative sync + LWW stops the edit-revert.
- **Local-first is gone for signed-in users.** Docs that call VEGA "local-first" are
  reconciled in this pass; the signed-in app needs connectivity. The signed-out demo
  remains local.
- **A one-time repo restructure** (`src/` → `apps/web/`, new `apps/server` +
  `packages/shared`) lands before feature work — cheapest now, while the repo is small.
- **Two deploy targets** (Cloud Run + Firebase Hosting) and new GCP surface (Secret
  Manager, Cloud Scheduler, Workload Identity) to wire into CI.
- **Clean cutover, no data migration** — signed-in paths were unverified with ~no real
  prod data, so we reseed rather than migrate.

### Deferred (not decided this pass)

- **Observability** beyond Cloud Run's built-in logs/metrics (structured logging,
  sync-health metrics) — v1, not MVP.
- **Rate-limiting / abuse controls** — single-user for now; revisit if the app opens up.
- **Realtime multi-device** updates — deferred to v1; MVP is optimistic + refetch.
- **The life-coach agent** — its own spec + ADR later, once the backend is proven.
- **Framework/mechanism specifics** still open in the spec (Hono vs Fastify was settled
  as Hono here; deletion retention window, webhook-registry location, write-failure UX)
  land in the implementation plan.

## Correction (2026-10-21)

Full-stack e2e does not run inside `npm run verify`: the two full-stack specs skip unless
`VEGA_FULLSTACK_E2E=1`. Server tests run against the emulator; the signed-in path through a
real server remains a manual smoke.
