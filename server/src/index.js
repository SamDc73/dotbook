// Dotbook server — sync relay, and later ingest + LLM classification.
// `bun src/index.js` serves the default export.

import { createApp } from "./app.js"
import { CONFIG } from "./config.js"
import { openDatabase } from "./db/adapter.js"
import { migrate } from "./db/index.js"

const db = openDatabase(CONFIG.dbPath)
migrate(db)

const app = createApp({ db, token: CONFIG.token, corsOrigins: CONFIG.corsOrigins })

export default { port: CONFIG.port, fetch: app.fetch }
