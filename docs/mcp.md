# AI tools (MCP)

The server speaks the [Model Context Protocol](https://modelcontextprotocol.io),
so an AI tool (Claude Code, Cursor, VS Code, Claude Desktop, anything that
speaks MCP) can read the log and write to it: lines, plans, todos, habits,
templates, recurring events, and the ring's and screen time's numbers.

Everything an AI tool writes goes the same road a device's write takes. It
becomes sync messages, reaches the phone on its next sync, and is marked
`source: mcp`. A line written through MCP is parsed, stamped and
template-snapshotted exactly like one typed in the app.

## Turn it on

The endpoint is part of the server, under the API path Caddy already proxies:

```
https://$DOMAIN/api/v1/mcp          self-hosted
http://localhost:3000/api/v1/mcp    local dev (cd server && bun run dev)
```

An AI tool gets in with an **MCP token**, minted for your user by the CLI and
printed once:

```sh
bun src/cli.js token add sam --scope mcp:write --label "claude code"   # locally
docker compose exec server bun src/cli.js token add sam --scope mcp:write --label "claude code"
```

Two things to know:

- **`TZ` matters.** "Today", and every time the server writes into a line
  (`7:36 am took nootstack`), are read in the server's zone. Docker's default is
  UTC; set `TZ` in `.env`.
- **An MCP token is not a device token.** Logging in gives a device a token
  that syncs the whole database; an AI tool never gets one of those, and an
  MCP token cannot sync. Revoke one with `bun src/cli.js token revoke <id>`
  (`token list sam` shows them) without touching a phone.

## Read or write: the token's scope decides

| Scope | Sees | Use it for |
|---|---|---|
| `mcp:read` | the 7 read tools only. The write tools are not even listed | questions, reviews, planning advice |
| `mcp:write` | all 24 tools | "log that I took…", "move that todo to Friday" |

A client with a read token cannot write, however it is prompted: the server
builds a separate tool list for each token on every request. Tokens belong to
a user, so a tool sees that user's log and nobody else's.

## Connect a client

[`mcp.json`](../mcp.json) at the repo root is the template. It has one entry per
access level, and the tokens come from environment variables, never from the file:

```sh
export DOTBOOK_URL=https://life.example.com
export DOTBOOK_MCP_WRITE_TOKEN=…   # for "dotbook"
export DOTBOOK_MCP_READ_TOKEN=…    # for "dotbook-readonly"
```

Keep the entry whose access you want that tool to have, and delete the other.
With both, the read tools appear twice.

### Claude Code (verified)

Per project: copy `mcp.json` to `.mcp.json` in the project, and approve it when
Claude Code asks. It expands `${VAR}` and `${VAR:-default}` itself. Or once, for
every project:

```sh
claude mcp add --transport http --scope user dotbook \
  https://life.example.com/api/v1/mcp \
  --header "Authorization: Bearer $DOTBOOK_MCP_WRITE_TOKEN"
```

To try it without touching any config:
`claude --strict-mcp-config --mcp-config mcp.json`.

### Cursor

`~/.cursor/mcp.json` (or `.cursor/mcp.json` in a project). Same shape, but
Cursor writes environment variables as `${env:NAME}`:

```json
{
	"mcpServers": {
		"dotbook": {
			"url": "https://life.example.com/api/v1/mcp",
			"headers": { "Authorization": "Bearer ${env:DOTBOOK_MCP_WRITE_TOKEN}" }
		}
	}
}
```

### VS Code

`.vscode/mcp.json`. VS Code's key is `servers`, and it can prompt for the token
once and store it as a secret:

```json
{
	"inputs": [{ "type": "promptString", "id": "dotbook-token", "description": "Dotbook MCP token", "password": true }],
	"servers": {
		"dotbook": {
			"type": "http",
			"url": "https://life.example.com/api/v1/mcp",
			"headers": { "Authorization": "Bearer ${input:dotbook-token}" }
		}
	}
}
```

### Claude Desktop, claude.ai, and anything else

Any client that can send a URL with an `Authorization: Bearer …` header works.
Clients that only accept OAuth for remote servers (claude.ai custom connectors,
Claude Desktop's Connectors screen) cannot use a static token. The server does
not run an OAuth authorization server; see *Not here* below.

## The tools

Read (both tokens):

| Tool | What |
|---|---|
| `get_day` | one day: lines in time order, open todos, recurring events not yet written, habit verdicts, ring and screen time, plus `today`, `now` and the timezone. **Start here** |
| `search_lines` | lines containing some text, newest first, over a day range |
| `list_todos` | open (dated by date, then the queue), done, trashed, or all |
| `list_habits` | each habit's verdict per day, `manual` or `llm` |
| `list_templates` | templates, the version in force today, every version |
| `list_recurring` | recurring rules, each as the line its occurrences will read |
| `get_passive_data` | sleep, vitals, steps, screen time over a range. Apps and sites kept apart (the double-count rule) |

Write (write token only):

| Tool | What |
|---|---|
| `add_line` | a line as typed: `7:36 took nootstack`, `8:30 -> 10:00 deep work`. Untimed on today → stamped with now; a time still ahead → a plan |
| `add_plan` | a plan block, whatever the clock (the app's `/plan`) |
| `edit_line` | replace a line's text; time and kind are read again |
| `confirm_plan` | "did it" — plan → log |
| `delete_line` | soft delete |
| `add_todo` | with the `/todo` grammar: `book dentist tmr`, `read tabs later`; or an explicit `due` |
| `close_todo` | `done` or `trashed`; writes the `done: …` line, linked, as the app does |
| `start_todo` | writes `started: …`, linked |
| `set_todo_due` | a new date, or `later` for the queue |
| `schedule_todo` | a plan line linked to the todo; scheduling again replaces it |
| `tick_habit` | the person's verdict: `kept`, `broken`, or `clear` |
| `add_habit`, `remove_habit` | `do` or `avoid` |
| `create_template`, `add_template_version` | a new stack, or its next version from a day on |
| `add_recurring`, `remove_recurring` | daily / weekly / monthly rules |

Every tool is annotated (`readOnlyHint`, `destructiveHint`), so a client can
auto-approve reads and ask before anything removes.

## How it is built

- `server/src/mcp/handler.js`: the route. It checks `Origin` (a browser page
  may call only from `CORS_ORIGINS`), looks the bearer token up in the accounts table (stored hashed,
  scoped, revocable), and builds a fresh `McpServer` per request with the tools that token allows.
  It uses the official SDK (`@modelcontextprotocol/server`): Streamable HTTP,
  stateless, serving both 2025-era clients (`initialize`) and 2026-07-28 ones
  (`server/discover`, no sessions).
- `server/src/mcp/tools/*.js`: one file per part of the app.
- `server/src/db/*.js`: the server's half of `app/db/*.js`. Writes go through
  `publish` / `publishUpdate`. The rules come from `@dotbook/core`: the parser,
  `lineKind` (plan vs log), template resolution, `effectiveTick`, recurrence.
- What the model is told about the data (`instructions`) lives with the other
  prompts in `server/src/ai/prompts.js`.

## Not here

- **OAuth.** Static bearer tokens only, so OAuth-only clients (above) cannot
  connect. Adding it means running an authorization server; the SDK covers the
  resource-server half (`requireBearerAuth` already gates this route).
- **Timers and reminders.** Both fire on a device (notifications, exact
  alarms), so they stay device-only. A running timer still shows in `get_day`.
- **The active todo.** Which todo a device's timer counts toward is that
  device's own setting, so `start_todo` writes the line and link but does not
  change it.
- **Materialising recurring events.** A device writes a day's occurrences when
  it opens that day; the server only shows them as `recurring` in `get_day`.
  Two writers would each write their own copy.
