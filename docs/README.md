# Docs

| Path | Holds | Naming |
|---|---|---|
| [`product-overview.md`](product-overview.md) | What VEGA is & how its parts connect | — |
| [`style-guide.md`](style-guide.md) | Naming, comments, file structure | — |
| [`release-process.md`](release-process.md) | Commits, the gate, CI scope, releasing, rollback | — |
| [`DECISIONS.md`](DECISIONS.md) | Standing product and engineering decisions | fixed name |
| [`adr/`](adr/) | Architecture decision records | `YYYY-MM-DD-NNNN-<slug>.md` |
| [`heroui/`](heroui/) | HeroUI v3 API reference for agents | — |

Local-only and gitignored, kept on the owner's disk for retros:

| Path | Holds | Naming |
|---|---|---|
| `specs/` | Feature specifications | `YYYY-MM-DD-<slug>.md` |
| `plans/` | Implementation plans, usually one per spec | `YYYY-MM-DD-<slug>.md` |
| `runs/` | Reports from autonomous build runs | `YYYY-MM-DD-<name>/` |
| `archive/` | Frozen docs kept for history; not current | `YYYY-MM-DD-<slug>.md` |

Agent rules live in [`../CLAUDE.md`](../CLAUDE.md), which wins on any conflict. GCP and CI
setup lives in [`../infra/`](../infra/).

Spec status lines are not maintained. What shipped, and when, is recorded by release tags,
GitHub Releases and `CHANGELOG.md`.
