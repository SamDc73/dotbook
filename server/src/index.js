// Dotbook server — web app, sync relay, browser-time ingest, LLM
// classification, MCP. One process: HTTP on PORT always, and when TLS_CERT and
// TLS_KEY are set, HTTPS on TLS_PORT too — the compose healthcheck and LAN use
// the plain one, the internet-facing name the secure one.

import { join } from "node:path"
import { classifierFor } from "./ai/adapter.js"
import { runPending } from "./ai/classify.js"
import { createApp } from "./app.js"
import { CONFIG } from "./config.js"
import { ensureAccountTables, users } from "./db/accounts.js"
import { openDatabase } from "./db/adapter.js"
import { userDatabases } from "./db/perUser.js"

const accounts = openDatabase(join(CONFIG.dataDir, "accounts.sqlite"))
await ensureAccountTables(accounts)
const databaseFor = userDatabases(CONFIG.dataDir)

const classifier = classifierFor(CONFIG.ai)
const app = createApp({
	accounts,
	databaseFor,
	corsOrigins: CONFIG.corsOrigins,
	signup: CONFIG.signup,
	minPassword: CONFIG.minPassword,
	classifier,
	webRoot: CONFIG.webRoot,
})

// Classification is deferred and periodic: every user's finished days, whenever
// the server is up, and never on the sync path.
if (classifier) {
	setInterval(
		async () => {
			for (const user of await users(accounts)) {
				await runPending(await databaseFor(user.id), user.id, classifier)
			}
		},
		CONFIG.classifyEveryMin * 60 * 1000
	)
}

Bun.serve({ fetch: app.fetch, port: CONFIG.port })
if (CONFIG.tlsCert) {
	Bun.serve({
		fetch: app.fetch,
		port: CONFIG.tlsPort,
		tls: { cert: Bun.file(CONFIG.tlsCert), key: Bun.file(CONFIG.tlsKey) },
	})
}
