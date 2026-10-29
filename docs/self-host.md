# Self-hosting

One box, one command, one image, one file of data. The phone app works
forever without any of this; the server adds sync, the web app, browser-time
ingestion, and LLM habit classification.

## What you need

- A machine with Docker (or Podman) and `docker compose`.
- A name that resolves to it: a public domain, or a Tailscale MagicDNS name.
- HTTPS. Not optional for the web app: browsers reserve its browser-side
  storage — and Notifications and Web Push — for secure contexts. That is two
  env vars pointing at a certificate file — `tailscale cert` for a Tailscale
  name, `certbot` or your provider for a public domain. (Android, sync, MCP
  and the extension run fine over plain HTTP on a LAN; a browser on the same
  box can use `http://localhost`.)

## Set up

```sh
git clone <this repo> dotbook && cd dotbook
cp server/.env.example .env
```

Edit `.env`:

| Variable | Set it to |
|---|---|
| `DOMAIN` | `life.example.com` — the name you will reach the app on (ntfy uses it for its base URL; add this line, it is not in the example) |
| `TZ` | your zone, e.g. `Europe/Berlin` — "today" and server-written times use it (the container's default is UTC) |
| `SIGNUP` | leave at `first`: the first person to open the app creates the account, then sign-up closes. `open` keeps it open for a household; `closed` means accounts come from the CLI |
| `PORT` | leave at `3000` |
| `DATA_DIR` | leave it; compose sets `/data` (the `data` volume) |

`CORS_ORIGINS` stays empty: the web app and the API are the same origin now, so
nothing cross-origin happens. Set it only for a web app served elsewhere (e.g.
local dev against the deployed API).

Then:

```sh
docker compose pull && docker compose up -d
```

That pulls the one image GitHub builds on every push (Bun serving the API and
the exported web app from one process — `.github/workflows/docker.yml`), pulls
ntfy, and starts both. To build the image on the box instead, for a fork or a
change of your own, `docker compose up -d --build`. The web app is at
`http://$DOMAIN` straight away (plain HTTP on port 80) and at
`https://$DOMAIN` once the certificate below is in place; the API lives under
`/api/v1/` on the same origin. Check: `curl http://$DOMAIN/api/v1/health` →
`{"ok":true}`.

## HTTPS (two env vars)

The server speaks TLS itself when `TLS_CERT` and `TLS_KEY` point at a
certificate and its key. Put both files in `certs/` next to
`docker-compose.yml` (it is mounted read-only into the containers) as
`cert.pem` and `key.pem`, and add to `.env`:

```
TLS_CERT=/certs/cert.pem
TLS_KEY=/certs/key.pem
```

`docker compose up -d` again, and `https://$DOMAIN` answers on 443 (compose
maps it to the server's TLS port, 8443 inside). Where the certificate comes
from:

- **Tailscale name (private, no public DNS):** on the box, `tailscale cert
  box.tail1234.ts.net`, then copy the two files it prints into `certs/`.
  Tailscale renews it; re-copy after renewal.
- **Public domain:** `certbot certonly` (or your DNS provider's tooling), copy
  `fullchain.pem` → `cert.pem` and `privkey.pem` → `key.pem`. Repeat on
  renewal, or script the copy as a deploy hook.
- **Testing only:** `mkcert` or a self-signed cert — browsers will warn until
  you trust it.

Open `https://$DOMAIN`, Settings → Server → **Log in**, and **Create account**:
the first sign-up is open. From then on sign-up is closed (see `SIGNUP`); more
people come in through the CLI:

```sh
docker compose exec server bun src/cli.js user add alex
```

### A plain LAN box, no names at all

With neither a domain nor Tailscale, the host's IP over plain HTTP still
carries the Android app, sync, MCP and the browser extension — none of those
are browsers asking for storage. The **web app** is different: browsers only
allow its browser-side database (OPFS, Web Locks) in a secure context, so over
plain http it stops with a clear "needs HTTPS" screen. One browser on the same
box as the server may use `http://localhost`; anyone else needs a certificate
from the section above. Notifications and Web Push share the rule either way —
secure contexts only.

## Where the data lives

Everything is SQLite in the `data` volume, inside the `server` container:
`/data/accounts.sqlite` (users and tokens) and one `/data/users/<id>.sqlite`
per user (their relay messages plus a replica of their devices' tables).
Certificates live in `certs/` on the host, ntfy's cache in `ntfy`.

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
Web Push, which ntfy provides. ntfy takes the same certificate the app uses —
one certificate serves `https://$DOMAIN` and `https://$DOMAIN:8444`, a
different port needs no second name. Give the ntfy service in
`docker-compose.yml` a published port and its TLS (the `certs/` volume is
already mounted):

```yaml
    ports:
      - "8444:443"
    environment:
      NTFY_LISTEN_HTTPS: ":443"
      NTFY_CERT_FILE: /certs/cert.pem
      NTFY_KEY_FILE: /certs/key.pem
```

(keep its other environment lines as they are). Then the VAPID keypair:

```sh
docker compose run --rm ntfy webpush keys
```

Copy the two keys it prints into `.env` as `NTFY_WEB_PUSH_PUBLIC_KEY` and
`NTFY_WEB_PUSH_PRIVATE_KEY`, set `NTFY_WEB_PUSH_EMAIL_ADDRESS` to a contact
address (push services require one), and `docker compose up -d` again. Open
`https://$DOMAIN:8444` in Firefox, install it as a PWA, subscribe to a topic
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

It is printed once. The endpoint is `https://$DOMAIN/api/v1/mcp`, on the same
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
