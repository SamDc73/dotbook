// Dotbook server — sync relay, browser-time ingest, LLM classification.
// `bun src/index.js` serves the default export.

import { classifierFor } from "./ai/adapter.js"
import { runPending } from "./ai/classify.js"
import { createApp } from "./app.js"
import { CONFIG } from "./config.js"
import { openDatabase } from "./db/adapter.js"
import { migrate } from "./db/index.js"

const db = openDatabase(CONFIG.dbPath)
await migrate(db)

const classifier = classifierFor(CONFIG.ai)
const app = createApp({
	db,
	token: CONFIG.token,
	corsOrigins: CONFIG.corsOrigins,
	groupId: CONFIG.groupId,
	classifier,
})

// Classification is deferred and periodic: it backfills finished days whenever
// the server is up, and never runs on the sync path.
if (classifier) {
	setInterval(() => runPending(db, CONFIG.groupId, classifier), CONFIG.classifyEveryMin * 60 * 1000)
}

export default { port: CONFIG.port, fetch: app.fetch }
