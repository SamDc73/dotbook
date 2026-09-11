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

/**
 * The adapter over an already-open bun:sqlite `Database`. `run`/`all`/`get`
 * stay synchronous — core awaits them, and awaiting a plain value is free.
 */
export function adapt(sqlite) {
	// One transaction at a time. Core's transaction callbacks are async (the
	// adapter contract is shared with expo-sqlite, whose API is only async), and
	// bun:sqlite's own `db.transaction()` cannot run an async callback — it
	// commits when the function returns, before the promise settles. So the
	// transaction is BEGIN / COMMIT / ROLLBACK by hand, and a queue serialises
	// callers: SQLite has one transaction per connection, so a second BEGIN
	// while an awaited callback is still inside the first would throw.
	let queue = Promise.resolve()
	function transaction(fn) {
		const turn = queue.then(async () => {
			sqlite.exec("BEGIN")
			try {
				const result = await fn()
				sqlite.exec("COMMIT")
				return result
			} catch (error) {
				sqlite.exec("ROLLBACK")
				throw error
			}
		})
		// The next caller waits for this one to finish, however it finished.
		queue = turn.catch(() => undefined)
		return turn
	}

	return {
		run: (sql, params = []) => sqlite.query(sql).run(...params),
		all: (sql, params = []) => sqlite.query(sql).all(...params),
		get: (sql, params = []) => sqlite.query(sql).get(...params),
		transaction,
	}
}
