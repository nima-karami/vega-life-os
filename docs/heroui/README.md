# HeroUI v3 — agent reference docs

Reference material for migrating this app from **HeroUI v2.8.10 → v3** and for
building new UI against the v3 API. Point subagents at these instead of letting
them guess the API.

## Files

- **`v3-migration-and-theming.md`** — the high-value slice: components index,
  v3 introduction (composition / BEM model), the v2→v3 migration guide (incl. the
  "for AI assistants" entry point), hooks migration, and the styling & theming
  changes (CSS-variable theming replaces the v2 Tailwind plugin). Start here.
- **`v3-react-docs-index.md`** — the full map: every component + migration page
  with its URL and a one-line description. Use it to fetch a specific component's
  full v3 API on demand.

## Refreshing

These were assembled from HeroUI's official LLM docs:

- Full React docs (markdown): <https://heroui.com/react/llms-full.txt>
- Index: <https://heroui.com/react/llms.txt>
- Per-component raw source: `https://raw.githubusercontent.com/heroui-inc/heroui/refs/heads/v3/apps/docs/content/docs/en/react/...`

> The official `heroui agents-md` CLI command requires an interactive TTY
> (arrow-key menu) and can't run in automation, so these were pulled from the
> published `llms-full.txt` instead — same source content. To regenerate the
> CLI's own `AGENTS.md` interactively, run in a real terminal:
> `npx heroui-cli@latest agents-md --react --migration`
