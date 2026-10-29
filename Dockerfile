# One image: the Bun server with the exported web app baked in. The server
# serves both /api and the app itself (server/src/web.js), plain HTTP — no
# Caddy, no TLS. See docs/self-host.md.

# Debian straight from Docker Hub, with Bun installed from its GitHub release:
# Bun's own image lives only here, and one anonymous library pull a build is
# well under the 100/6h quota. (public.ecr.aws's mirror was tried first — its
# anonymous data quota runs dry: 429 toomanyrequests.)
FROM debian:bookworm-slim
ARG BUN_VERSION=1.2.23
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl unzip \
 && rm -rf /var/lib/apt/lists/* \
 && curl -fsSL https://bun.sh/install | BUN_INSTALL=/usr/local bash -s "bun-v${BUN_VERSION}"
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

# Single stage on purpose: the workspace's node_modules are hoisted, so
# splitting "runtime-only" dependencies out would mean a second, partial
# install with its own lockfile drift. The extra image size buys zero moving parts.
WORKDIR /src/server
ENV PORT=3000
ENV DATA_DIR=/data
ENV WEB_ROOT=/src/app/dist
VOLUME /data
EXPOSE 3000
CMD ["bun", "src/index.js"]
