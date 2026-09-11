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
| `DOTBOOK_TOKEN` | `openssl rand -hex 32` — the one secret every device sends |
| `DOMAIN` | `life.example.com` — the name Caddy will serve (add this line; it is not in the example) |
| `CORS_ORIGINS` | `https://life.example.com` — the web app's origin, no wildcard |
| `PORT` | leave at `3000` |
| `DB_PATH` | leave it; compose overrides it to `/data/dotbook.sqlite` |

Then:

```sh
docker compose up -d
```

That builds two images from the one `Dockerfile` (the Bun API, and Caddy with
the exported web app baked in), pulls ntfy, and starts all three. The web app
is at `https://$DOMAIN`, the API under `https://$DOMAIN/api/v1/`, ntfy at
`https://ntfy.$DOMAIN`. Check: `curl https://$DOMAIN/api/v1/health` → `{"ok":true}`.

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

Everything is one SQLite file in the `data` volume: `/data/dotbook.sqlite`
inside the `server` container (relay messages plus a replica of every device's
tables). Certificates live in `caddy_data`, ntfy's cache in `ntfy`.

**Backup** = copy that one file. For a consistent copy while running:

```sh
docker compose exec server bun -e "import('bun:sqlite').then(({ Database }) => new Database('/data/dotbook.sqlite').run(\"VACUUM INTO '/data/backup.sqlite'\"))"
docker compose cp server:/data/backup.sqlite ./dotbook-$(date +%F).sqlite
```

(`sqlite3 /data/dotbook.sqlite ".backup /data/backup.sqlite"` does the
same if `sqlite3` is installed on the host.) Restore = stop, put the file back,
start.

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

In the app: **Settings → Server** (arrives with phase 8), enter
`https://$DOMAIN` and the `DOTBOOK_TOKEN`. Until then the phone runs
fully offline; nothing is lost, sync just has not started.

## Updating

```sh
git pull && docker compose up -d --build
```

Schema migrations run on start, gated by the database's version; a downgrade
is not supported — restore the backup instead.
