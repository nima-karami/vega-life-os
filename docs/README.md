# Docs

| Path | Holds | Naming |
|---|---|---|
| [`product-overview.md`](product-overview.md) | What VEGA is and how its parts connect | — |
| [`style-guide.md`](style-guide.md) | Naming, comments, file structure | — |
| [`release-process.md`](release-process.md) | Commits, the gate, CI scope, releasing, rollback | — |
| [`specs/`](specs/) | Feature specifications | `YYYY-MM-DD-<slug>.md` |
| [`specs/DECISIONS.md`](specs/DECISIONS.md) | Standing product and engineering decisions | fixed name |
| [`plans/`](plans/) | Implementation plans, usually one per spec | `YYYY-MM-DD-<slug>.md` |
| [`adr/`](adr/) | Architecture decision records | `YYYY-MM-DD-NNNN-<slug>.md` |
| [`runs/`](runs/) | Reports from autonomous build runs | `YYYY-MM-DD-<name>/` |
| [`heroui/`](heroui/) | HeroUI v3 API reference for agents | — |
| [`archive/`](archive/) | Frozen docs kept for history; not current | `YYYY-MM-DD-<slug>.md` |

Agent rules live in [`../CLAUDE.md`](../CLAUDE.md), which wins on any conflict. GCP and CI
setup lives in [`../infra/`](../infra/).

Spec status lines are not maintained. What shipped, and when, is recorded by release tags,
GitHub Releases and `CHANGELOG.md`.
