// Serving the exported web app from the same process as the API — one image,
// no Caddy. Assets come from WEB_ROOT (expo export); every GET that is not the
// API and not a file gets the app's index.html (`web.output: "single"` — every
// route is index.html).

import { join } from "node:path"
import { serveStatic } from "hono/bun"

// API requests never touch the filesystem: an unmatched /api path stays a 404.
const isWebPage = (path, method) => method === "GET" && !path.startsWith("/api/")

export function serveWeb(app, root) {
	const files = serveStatic({ root })

	app.use("/*", async (c, next) => {
		if (isWebPage(c.req.path, c.req.method)) return files(c, next)
		await next()
	})

	// SPA fallback, read fresh each time — caching a stale index.html after a
	// re-export points the page at a bundle that no longer exists.
	app.get("/*", async (c) => {
		if (!isWebPage(c.req.path, c.req.method)) return c.notFound()
		return c.html(await Bun.file(join(root, "index.html")).text())
	})
}
