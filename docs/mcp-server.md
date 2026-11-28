# VEGA MCP server

VEGA exposes an [MCP](https://modelcontextprotocol.io) endpoint so your own agents can read and
operate your account: plan the day, check off habits, write the journal, manage goals, log books.
It works on the signed-in cloud account only. The signed-out demo lives in your browser, where
no server can reach it.

Design and reasoning: [ADR 0006](adr/2026-11-20-0006-mcp-server.md).

## Connect an agent

1. Sign in to VEGA and open **Settings → Agent access (MCP)**.
2. Choose **New token**, name it after the agent ("Claude Code laptop"), and pick a scope:
   - **Read only**: the agent can look but never change anything.
   - **Read & write**: create, update and delete across every feature. Bulk import and
     wipe-all stay in the app.
3. Copy the token. It's shown once. The dialog also gives you ready-made snippets.

Claude Code:

```bash
claude mcp add --transport http vega <endpoint>/mcp --header "Authorization: Bearer <token>"
```

Codex (`~/.codex/config.toml`):

```toml
[mcp_servers.vega]
url = "<endpoint>/mcp"
http_headers = { Authorization = "Bearer <token>" }
```

Any client that takes JSON config:

```json
{ "mcpServers": { "vega": { "type": "http", "url": "<endpoint>/mcp",
  "headers": { "Authorization": "Bearer <token>" } } } }
```

`<endpoint>` is the VEGA API URL that Settings shows. Locally it's `http://127.0.0.1:8787`.

To cut an agent off, revoke its token in Settings. Its next request fails.

## What an agent can do

Start with `get_overview`: it returns today's date in your time zone and the ids of your active
values, goals and habits.

| Tool | Scope | Does |
|---|---|---|
| `get_overview` | read | Today, counts, active values / goals / habits, calendar connection |
| `get_day` | read | One day's tasks (scheduled, anytime, done), calendar events and journal entry |
| `list_records` | read | Any collection, with equality filters, text search and paging |
| `get_record` | read | One record by id |
| `describe_collection` | read | The fields a collection takes, its id format, and the rules VEGA applies |
| `create_record` | write | Create in any writable collection. VEGA fills defaults the way the app does |
| `update_record` | write | Patch a record, applying the app's rules (one kind of task change per call) |
| `delete_record` | write | Delete. A delete that would remove or unlink other records first returns a preview and a `confirmCascade` code to pass back |
| `set_task_status` | write | Mark a task done, skipped, open or to do |
| `check_in_habit` | write | Mark a habit done or skipped for a day (today by default) |
| `set_habit_state` | write | Pause, resume, archive or unarchive a habit |
| `edit_subgoals` | write | Add, complete, reopen or remove a goal's subgoals; progress follows |
| `write_journal` | write | Write or append to a day's journal, gratitude and mood |

Changes made by an agent appear in an open VEGA tab at its next sync check: within 5 minutes,
or right away when you switch back to the tab.

An agent's write never overwrites a change made since the agent read the record: VEGA re-plans
it, or answers `CONFLICT`. The reverse isn't guarded: a VEGA tab that hasn't synced since the
agent's write saves whole records, so editing that record there can undo the agent's change,
the same as editing on two devices.

A very large change (hundreds of tasks) commits in parts. If one part fails, the answer lists
what landed, and running the same call again finishes the job. A large delete re-run asks for a
fresh `confirmCascade`, because what's left to delete has changed.

Dates, times and amounts must use the formats the app writes (`YYYY-MM-DD`, `HH:mm`, whole
cents and so on). `describe_collection` names the format of each such field, and a write in any
other format is refused with `BAD_REQUEST`.

## Limits

- Calendar events and finance statement imports are read-only through MCP.
- Profile settings, token expiry and analytics tools aren't available yet.
- "Today" follows the time zone of the browser that created the token. To change it, create a
  new token.
