# syntax=docker/dockerfile:1
# Two images from one file, picked by `target:` in docker-compose.yml:
#   server — the Bun API (sync relay). Serves nothing static.
#   web    — Caddy with the exported web app baked in. Static files are
#            Caddy's job, so the server stays a dumb relay.

# ---- build: install the workspace and export the web app -------------------
FROM ghcr.io/oven-sh/bun:1 AS build
WORKDIR /src
ENV CI=1 EXPO_NO_TELEMETRY=1 DO_NOT_TRACK=1

# Manifests first so `bun install` is cached until a dependency changes.
COPY package.json bun.lock ./
COPY packages/core/package.json packages/core/
COPY app/package.json app/
COPY server/package.json server/
RUN bun install --frozen-lockfile

COPY . .
RUN cd app && bunx expo export --platform web

# ---- server: the API ------------------------------------------------------
# Single stage on purpose: the workspace's node_modules are hoisted, so
# splitting "runtime-only" dependencies out would mean a second, partial
# install with its own lockfile drift. The extra image size buys zero moving parts.
FROM build AS server
WORKDIR /src/server
ENV PORT=3000
ENV DATA_DIR=/data
VOLUME /data
EXPOSE 3000
CMD ["bun", "src/index.js"]

# ---- web: Caddy + the static export -----------------------------------------
FROM public.ecr.aws/docker/library/caddy:2 AS web
COPY --from=build /src/app/dist /srv/www
COPY Caddyfile /etc/caddy/Caddyfile
