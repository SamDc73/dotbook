# Self-hosting

One box, one command, one file of data. The phone app works forever without
any of this; the server adds sync, the web app, browser-time ingestion, and
LLM habit classification.

## What you need

- A machine with Docker (or Podman) and `docker compose`.
- A name that resolves to it: a public domain, or a Tailscale MagicDNS name.
- HTTPS. Not optional: browser Notifications and Web Push only exist in a
  secure context, so the web app must be served over TLS. Caddy does this for
  you — with a public domain automatically, on a private name with `tls internal`.

## Set up

```sh
git clone <this repo> dotbook && cd dotbook
cp server/.env.example .env
```

Edit `.env`:

| Variable | Set it to |
|---|---|
| `DOMAIN` | `life.example.com` — the name Caddy will serve (add this line; it is not in the example) |
| `CORS_ORIGINS` | `https://life.example.com` — the web app's origin, no wildcard |
| `TZ` | your zone, e.g. `Europe/Berlin` — "today" and server-written times use it (the container's default is UTC) |
| `SIGNUP` | leave at `first`: the first person to open the app creates the account, then sign-up closes. `open` keeps it open for a household; `closed` means accounts come from the CLI |
| `PORT` | leave at `3000` |
| `DATA_DIR` | leave it; compose sets `/data` (the `data` volume) |

Then:

```sh
docker compose pull && docker compose up -d
```

That pulls the two images GitHub builds on every push (the Bun API, and Caddy
with the exported web app baked in — `.github/workflows/docker.yml`), pulls
ntfy, and starts all three. To build the two images on the box instead, for a
fork or a change of your own, `docker compose up -d --build`. The web app
is at `https://$DOMAIN`, the API under `https://$DOMAIN/api/v1/`, ntfy at
`https://ntfy.$DOMAIN`. Check: `curl https://$DOMAIN/api/v1/health` → `{"ok":true}`.

Open `https://$DOMAIN`, Settings → Server → **Log in**, and **Create account**:
the first sign-up is open. From then on sign-up is closed (see `SIGNUP`); more
people come in through the CLI:

```sh
docker compose exec server bun src/cli.js user add alex
```

### Private name, no public DNS (LAN, Tailscale)

Caddy cannot get a public certificate for `box.tail1234.ts.net`. Add one line
to **both** site blocks in `Caddyfile`:

```
{$DOMAIN} {
	tls internal
	…
}
ntfy.{$DOMAIN} {
	tls internal
	…
}
```

Caddy then signs with its own CA. Trust that CA once per device
(`docker compose exec caddy caddy trust` prints the root; import it on the
phone and in Firefox), or use Tailscale's own certificates instead
(`tailscale cert`) and point `tls` at those files.

## Where the data lives

Everything is SQLite in the `data` volume, inside the `server` container:
`/data/accounts.sqlite` (users and tokens) and one `/data/users/<id>.sqlite`
per user (their relay messages plus a replica of their devices' tables).
Certificates live in `caddy_data`, ntfy's cache in `ntfy`.

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

While a tab is open the web app notifies by itself. For a closed tab it needs
Web Push, which ntfy provides once it has a VAPID keypair:

```sh
docker compose run --rm ntfy webpush keys
```

Copy the two keys it prints into `.env` as `NTFY_WEB_PUSH_PUBLIC_KEY` and
`NTFY_WEB_PUSH_PRIVATE_KEY`, set `NTFY_WEB_PUSH_EMAIL_ADDRESS` to a contact
address (push services require one), and `docker compose up -d` again. Open
`https://ntfy.$DOMAIN` in Firefox, install it as a PWA, subscribe to a topic
with an unguessable name. Android uses the same ntfy through UnifiedPush — no
Google services involved.

## Pointing the phone at the server

In the app: **Settings → Server → Log in**, enter `https://$DOMAIN`, your
username and password. The phone keeps a token, never the password; **Log out**
revokes it on the server. Until then the phone runs fully offline; nothing is
lost, sync just has not started.

## Connecting AI tools (MCP)

Mint a token for your user — `mcp:write` for a tool that may log for you,
`mcp:read` for one that may only look:

```sh
docker compose exec server bun src/cli.js token add sam --scope mcp:write --label "claude code"
```

It is printed once. The endpoint is `https://$DOMAIN/api/v1/mcp`, behind the
same Caddy route as the rest of the API. Client setup and the tool list are in
[`mcp.md`](mcp.md).

## Updating

```sh
git pull && docker compose pull && docker compose up -d && docker image prune -f
```

The prune drops the images just replaced: on a small box they are what runs
the disk out.

Schema migrations run on start, gated by the database's version; a downgrade
is not supported — restore the backup instead.
