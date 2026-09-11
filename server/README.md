# @dotbook/server

The Bun + Hono server: a **dumb relay** for sync (it stores opaque messages and
hands them back), plus a replica of every device's tables for the LLM habit
classifier (phase 9). It never needs to understand a message to route it.

## Run locally

```sh
cd server
cp .env.example .env      # set DOTBOOK_TOKEN
bun run dev               # --watch, restarts on change
```

`bun test` from `packages/core` exercises the relay end to end through
`app.request()` — no network, two in-memory databases.

## Environment

Read once in `src/config.js`; nothing else touches `process.env`. Bun loads
`.env` on its own.

| Variable | Default | What |
|---|---|---|
| `PORT` | `3000` | listen port |
| `DOTBOOK_TOKEN` | — required | the bearer token every device sends |
| `DB_PATH` | `./data/dotbook.sqlite` | the one SQLite file (relay messages + replica) |
| `CORS_ORIGINS` | empty | comma-separated browser origins allowed to call the API; no wildcard |

In `docker-compose.yml` `DB_PATH` is forced to `/data/dotbook.sqlite`
(the `data` volume); see `docs/self-host.md`.

## Endpoints

All under `/api/v1/`, JSON in and out, camelCase.

| Method | Path | Auth | Does |
|---|---|---|---|
| `GET` | `/api/v1/health` | none | `{ "ok": true }` — the container health check |
| `POST` | `/api/v1/sync` | Bearer | CRDT exchange: `{ groupId, clientId, merkle, messages[] }` → `{ messages[], merkle }`. `400` bad shape, `401` no/bad token, `409` device clock more than 5 min ahead |

Later phases add ingestion (browser time) and classification routes here;
this table is the list of what exists, keep it current.
