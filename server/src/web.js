// Serving the exported web app from the same process as the API — one image,
// no Caddy. Assets come from WEB_ROOT (expo export); every GET that is not the
// API and not a file gets the app's index.html (`web.output: "single"` — every
// route is index.html).

import { join } from "node:path"
import { serveStatic } from "hono/bun"

// expo-sqlite keeps SQLite in a Worker whose synchronous path needs
// SharedArrayBuffer, which browsers allow only under these two headers — the
// same ones app/metro.config.js sets for the dev server.
const SECURITY_HEADERS = {
	"Cross-Origin-Embedder-Policy": "credentialless",
	"Cross-Origin-Opener-Policy": "same-origin",
}

// API requests never touch the filesystem: an unmatched /api path stays a 404.
const isWebPage = (path, method) => method === "GET" && !path.startsWith("/api/")

export function serveWeb(app, root) {
	const files = serveStatic({ root })

	app.use("/*", async (c, next) => {
		if (isWebPage(c.req.path, c.req.method)) {
			for (const [name, value] of Object.entries(SECURITY_HEADERS)) c.header(name, value)
			return files(c, next)
		}
		await next()
	})

	// SPA fallback: cached after the first request — the file does not change
	// during the process's life.
	let index = null
	app.get("/*", async (c) => {
		if (!isWebPage(c.req.path, c.req.method)) return c.notFound()
		index ??= await Bun.file(join(root, "index.html")).text()
		return c.html(index)
	})
}
