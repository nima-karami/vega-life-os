# VEGA · Life OS

A personal command center for one person's life. Everything ladders up
**Values → Goals → Habits → Tasks**, so each day's work traces back to a reason. Around that
ladder sit Today, a calendar with two-way Google Calendar sync, a journal, BrainWrite
(spaced-repetition cards), personal finance, analytics and a ⌘K command bar. Signed out, it
runs as a local-only demo on IndexedDB; signed in, data lives in the cloud behind the API
server. See [`docs/product-overview.md`](docs/product-overview.md) for the product itself.

**Live:** https://vega-life-os.web.app

## Architecture

npm-workspaces monorepo, TypeScript throughout, Node 24.

| Workspace | What it is | Stack |
|---|---|---|
| `apps/web` | The SPA and PWA, served by Firebase Hosting | React 19.2 · Vite 8 · Tailwind 4 · HeroUI 3 · react-router 8 · Zustand 5 · Dexie 4 · TipTap 3 · tRPC client 11 · Firebase 12 |
| `apps/server` | The API on Cloud Run (`vega-server`): signed-in reads/writes and Google Calendar sync | Hono 4 · tRPC 11 · Firebase Admin 14 (Firestore) · @googleapis/calendar |
| `packages/shared` | Zod 4 entity schemas and the `SCHEMA_HASH` both sides check | Zod 4 |

Clients never write to Firestore directly (`firestore.rules` denies all writes); every
signed-in write goes through the server, which validates it against `packages/shared`.

## Local setup

Requires Node 24 (`.nvmrc`).

```bash
npm ci
npm run dev        # web app on http://localhost:5180
```

With no env file, the web app runs as the signed-out local demo. To configure it, copy
`.env.example` to `.env.local` (Firebase web config and `VITE_API_URL`). For a signed-in
session, run the server too: `npm run dev --workspace @vega/server`, with the variables in
[`apps/server/.env.example`](apps/server/.env.example) set in its environment. The web app
looks for it at `http://127.0.0.1:8787` when `VITE_API_URL` is unset.

Server tests boot the Firestore and Auth emulators through firebase-tools, so they need
**JDK 21 first on `PATH`** (`java -version` to check). The full gate also expects `gitleaks`
and `osv-scanner` on `PATH`, and Playwright's Chromium for e2e.

## The gate

`npm run verify` is the single gate:

```
format:check → lint → typecheck → deadcode → check:lockfile → check:suppressions → test → dupes → scan:secrets → audit:deps → e2e
```

| Where | Runs |
|---|---|
| pre-commit | Biome on staged files, gitleaks on the staged diff |
| pre-push | format, lint, typecheck (`tsc -b`), deadcode (Knip), test, dupes (jscpd) |
| CI (`verify.yml`) | everything, plus sharded e2e and Semgrep SAST; skips work a docs-only or web-only change cannot affect |

No inline suppressions, ever; `check:suppressions` enforces it. Details in
[`docs/release-process.md`](docs/release-process.md) §3.

## Releasing

`npm run release` (or the `release` GitHub workflow) deploys only the targets that changed
since what is live, server before hosting, and `npm run release -- --dry-run` prints the
plan. Releases are being given CalVer tags (`vYYYY.M.N`) with a GitHub Release each, and a
`CHANGELOG.md` generated from them. The version lives in the tag, not in `package.json`.
The full process, including rollback, is in [`docs/release-process.md`](docs/release-process.md).

## Docs

- [`docs/README.md`](docs/README.md): index of specs, plans, ADRs and run reports
- [`docs/style-guide.md`](docs/style-guide.md): naming, comments, structure
- [`docs/release-process.md`](docs/release-process.md): commits, the gate, releasing
- [`CLAUDE.md`](CLAUDE.md): operating rules for agents working in the repo
- [`infra/`](infra/): one-time GCP and CI setup

Private project. All rights reserved.
