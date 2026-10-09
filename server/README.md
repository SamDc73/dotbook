# @dotbook/server

The Bun + Hono server: accounts, a **dumb relay** for sync (it stores opaque
messages and hands them back), a replica of every user's tables for the LLM
habit classifier, and the MCP endpoint for AI tools (`docs/mcp.md`). The relay
never needs to understand a message to route it.

## Run locally

```sh
cd server
cp .env.example .env      # set CORS_ORIGINS and TZ
bun run dev               # --watch, restarts on change
```

Then open the app, Settings → Server → Log in, and create your account: the
first sign-up is open, after that `SIGNUP` decides.

`bun test` here and in `packages/core` exercise accounts, the relay and the MCP
endpoint end to end through `app.request()` — no network, in-memory databases.

## Accounts

A user has a name and a password (argon2id, hashed by Bun). What a device or a
tool actually sends is a **token**: random, shown once, stored as SHA-256, with
one scope and a revoke date.

| Scope | Minted by | Lets the holder |
|---|---|---|
| `device` | logging in (`POST /api/v1/sessions`) | sync, send browser time, run classification — one user's data |
| `mcp:read` | the CLI | call the read tools over MCP |
| `mcp:write` | the CLI | call every tool over MCP |

Each user's data is its own SQLite file, `users/<id>.sqlite`; a user is their
own sync group. Nothing one user does can reach another's rows.

```sh
bun src/cli.js user add sam                                      # asks for the password
bun src/cli.js user list
bun src/cli.js token add sam --scope mcp:write --label "claude code"   # prints the token once
bun src/cli.js token list sam
bun src/cli.js token revoke <id>
```

In Docker: `docker compose exec server bun src/cli.js …`.

## Environment

Read once in `src/config.js`; nothing else touches `process.env`. Bun loads
`.env` on its own.

| Variable | Default | What |
|---|---|---|
| `PORT` | `3000` | listen port |
| `DATA_DIR` | `./data` | `accounts.sqlite` and `users/<id>.sqlite` live here |
| `SIGNUP` | `first` | who may create an account: `first` (until one exists), `open`, `closed` |
| `MIN_PASSWORD_LENGTH` | `8` | the shortest password accepted |
| `CORS_ORIGINS` | empty | comma-separated browser origins allowed to call the API; no wildcard |
| `TZ` | the machine's | the zone "today" and server-written times are read in (Docker: UTC unless set) |
| `AI_PROVIDER`, `AI_MODEL`, … | unset | habit classification; see `.env.example` |

In `docker-compose.yml` `DATA_DIR` is `/data` (the `data` volume); see
`docs/self-host.md`.

## Endpoints

All under `/api/v1/`, JSON in and out, camelCase. "Device" means a device token.

| Method | Path | Auth | Does |
|---|---|---|---|
| `GET` | `/health` | none | `{ "ok": true }` — the container health check |
| `POST` | `/users` | none | sign up: `{ username, password, device? }` → `201 { token, user, groupId }`. `403` sign-up closed, `409` name taken, `400` bad name or password, `429` too many tries |
| `POST` | `/sessions` | none | log in, same body and answer; `401` wrong name or password, `429` too many tries |
| `GET` | `/users/current` | device | `{ id, name }` — who this token is |
| `DELETE` | `/sessions/current` | device | log out: the token is revoked, `204` |
| `POST` | `/sync` | device | CRDT exchange: `{ groupId, clientId, merkle, messages[] }` → `{ messages[], merkle }`. `groupId` is the user's id; `400` bad shape, `403` another group, `409` device clock more than 5 min ahead |
| `POST` | `/browser-time` | device | the Firefox extension's rollups |
| `POST` | `/classify`, `GET` `/classify/status` | device | run and watch habit classification; `503` without an AI provider |
| `POST` | `/mcp` | MCP token | Model Context Protocol, Streamable HTTP (2025 and 2026-07-28 clients). `401` no/bad token, `403` foreign browser `Origin`. See `docs/mcp.md` |
