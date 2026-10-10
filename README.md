# Dotbook

A self-hosted, offline-first daily log. Type `7:36 woke up`, and the app removes
the repeated lines: versioned templates, reminders you answer from the shade,
recurring events, a timer that is just a row, todos that carry over as a view,
and an LLM that proposes habit ticks from what you wrote.

The conventions are `AGENTS.md`.

## Layout

| Path | What |
|---|---|
| `packages/core/` | logic shared by phone, web, and server: schema + migrations, line parsing, templates, recurrence, sync (CRDT), analysis, RingConn import |
| `app/` | one Expo codebase — Android and web |
| `server/` | Bun + Hono: sync relay, browser-time ingest, LLM habit classification |
| `extension/` | Firefox extension (desktop + Android) reporting active time per site |
| `docs/` | `self-host.md`, `palette.html` |

## Run

```sh
bun install

# tests and lint
bun run lint            # from the root

# the app
cd app && bun run web           # web, at localhost:8081
cd app && bun run android       # dev client on a connected device (needs Android Studio / Java)

# the server
cp server/.env.example server/.env   # set CORS_ORIGINS and TZ
cd server && bun run dev
```


Every script disables Expo's CLI telemetry (`EXPO_NO_TELEMETRY=1 DO_NOT_TRACK=1`); nothing here phones home.

Self-hosting (Caddy + ntfy + the API, one SQLite volume): `docs/self-host.md`.

## Where things are decided

- Every design value: `app/theme/tokens.css`. Material You overrides it on Android 12+.
- Every write to a synced table: `app/db/sync.js` — rows are messages first, tables second.
- The one prompt: `server/src/ai/prompts.js`.

## Your data

Settings → Your data exports everything as one Markdown file and imports the same
file back, on the phone and on the web. The log is the body, one section per day,
every line exactly as typed; then todos, habits with their ticks, templates with
their versions, and recurring rules:

```markdown
## 2026-10-09
- 7:36 am woke up
- [ ] 9:00 pm gym          ← a plan, not yet confirmed

## Todos
- [ ] call the dentist · 2026-10-10
- [x] write report · 2026-10-09

## Habits
- no sugar · avoid
  - 2026-10-09 · kept
```

Importing is additive and repeatable: a line, todo, habit, template version or rule
that is already there is skipped, and everything added syncs like anything typed.
A hand-written journal in the same shape imports too. Passive data (ring, screen
time) and the links between rows are not in the file.

## AI tools (MCP)

The server speaks the Model Context Protocol at `/api/v1/mcp`, so Claude Code,
Cursor, VS Code and the like can read your log and write to it: log lines, plan
blocks, todos (add, close, start, schedule), habit ticks, templates and
recurring events. Access is a token minted for your user: `mcp:read` lists only
the read tools, `mcp:write` every tool. See `docs/mcp.md`.

## Android app

Every `v*` tag publishes a signed APK under
[Releases](https://github.com/SamDc73/dotbook/releases): install it, then
Settings → Server → Log in. The app works fully offline without a server.
