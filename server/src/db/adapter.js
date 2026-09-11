// bun:sqlite behind the four-method adapter @dotbook/core/sync expects.

import { Database } from "bun:sqlite"
import { mkdirSync } from "node:fs"
import { dirname } from "node:path"

/** Open (creating if needed) the database file at `path`, in WAL mode. */
export function openDatabase(path) {
	if (path !== ":memory:") {
		mkdirSync(dirname(path), { recursive: true })
	}
	const sqlite = new Database(path, { create: true, strict: true })
	sqlite.exec("PRAGMA journal_mode = WAL")
	return adapt(sqlite)
}

/** The adapter over an already-open bun:sqlite `Database`. */
export function adapt(sqlite) {
	return {
		run: (sql, params = []) => sqlite.query(sql).run(...params),
		all: (sql, params = []) => sqlite.query(sql).all(...params),
		get: (sql, params = []) => sqlite.query(sql).get(...params),
		transaction: (fn) => sqlite.transaction(fn)(),
	}
}
