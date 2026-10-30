# Self-hosting

One box, one command, one image, one file of data. The phone app works
forever without any of this; the server adds sync, the web app, browser-time
ingestion, and LLM habit classification.

## What you need

- A machine with Docker (or Podman) and `docker compose`.
- A network only you reach. This stack speaks plain HTTP and asks for a login;
  it is built for a LAN or a VPN you own, not for the open internet.

## Set up

```sh
git clone <this repo> dotbook && cd dotbook
cp server/.env.example .env
```

Edit `.env`:

| Variable | Set it to |
|---|---|
| `TZ` | your zone, e.g. `Europe/Berlin` — "today" and server-written times use it (the container's default is UTC) |
| `SIGNUP` | leave at `first`: the first person to open the app creates the account, then sign-up closes. `open` keeps it open for a household; `closed` means accounts come from the CLI |
| `PORT` | leave at `3000` |
| `DATA_DIR` | leave it; compose sets `/data` (the `data` volume) |

`CORS_ORIGINS` stays empty: the web app and the API are the same origin, so
nothing cross-origin happens. Set it only for a web app served elsewhere (e.g.
local dev against the deployed API).

Then:

```sh
docker compose pull && docker compose up -d
```

That pulls the one image GitHub builds on every push (Bun serving the API and
the exported web app from one process — `.github/workflows/docker.yml`), pulls
ntfy, and starts both. To build the image on the box instead, for a fork or a
change of your own, `docker compose up -d --build`. The web app and the API
are both on port 80 (`/api/v1/` under the same origin). Check:
`curl http://<host>/api/v1/health` → `{"ok":true}`.

Open `http://<host>`, Settings → Server → **Log in**, and **Create account**:
the first sign-up is open. From then on sign-up is closed (see `SIGNUP`); more
people come in through the CLI:

```sh
docker compose exec server bun src/cli.js user add alex
```

### A note on browsers

Everything works on plain `http://<host>`: the Android app, sync, MCP, the
browser extension, and the web app — which keeps nothing in the browser; it
reads and writes your log on the server, so any browser on your network opens
it. (It is online-only for that reason; the Android app is the one that works
offline.)

## Where the data lives

Everything is SQLite in the `data` volume, inside the `server` container:
`/data/accounts.sqlite` (users and tokens) and one `/data/users/<id>.sqlite`
per user (their relay messages plus a replica of their devices' tables).
ntfy's cache lives in the `ntfy` volume.

**Backup** = copy those files. For a consistent copy while running:

```sh
docker compose exec server bun -e "
  import { Database } from 'bun:sqlite'; import { readdirSync, mkdirSync } from 'node:fs'
  mkdirSync('/data/backup/users', { recursive: true })
  for (const f of ['accounts.sqlite', ...readdirSync('/data/users').map((u) => 'users/' + u)])
    new Database('/data/' + f).run(\"VACUUM INTO '/data/backup/\" + f + \"'\")"
docker compose cp server:/data/backup ./dotbook-$(date +%F)
```

(`sqlite3 <file> ".backup <copy>"` per file does the same if `sqlite3` is
installed on the host.) Restore = stop, put the files back, start. One user's
data is one file: back it up, hand it over, or delete it on its own.

## Push when the browser is closed (ntfy Web Push)

Web Push is the one feature browsers reserve for secure contexts (HTTPS), so
on a plain-HTTP LAN it is not available — everything else is. The plumbing is
already there: ntfy runs alongside the server, Android reaches it through
UnifiedPush, and getting browser push back later is a matter of putting ntfy
on an HTTPS URL with its VAPID keys (`ntfy webpush keys`) — nothing in the
app changes.

## Pointing the phone at the server

In the app: **Settings → Server → Log in**, enter `http://<host>`, your
username and password. The phone keeps a token, never the password; **Log out**
revokes it on the server. Until then the phone runs fully offline; nothing is
lost, sync just has not started.

## Connecting AI tools (MCP)

Mint a token for your user — `mcp:write` for a tool that may log for you,
`mcp:read` for one that may only look:

```sh
docker compose exec server bun src/cli.js token add sam --scope mcp:write --label "claude code"
```

It is printed once. The endpoint is `http://<host>/api/v1/mcp`, on the same
origin as the rest of the API. Client setup and the tool list are in
[`mcp.md`](mcp.md).

## Updating

```sh
git pull && docker compose pull && docker compose up -d && docker image prune -f
```

The prune drops the images just replaced: on a small box they are what runs
the disk out.

Schema migrations run on start, gated by the database's version; a downgrade
is not supported — restore the backup instead.
