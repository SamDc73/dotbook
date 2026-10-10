import { applyMessages, messagesForInsert, messagesForUpdate } from "@dotbook/core/sync"

// The app's side of @dotbook/core/sync: expo-sqlite's async API behind the
// four-method adapter core expects, and the two helpers every write to a synced
// table goes through. A write becomes messages first and a table row second, so
// local and foreign writes travel one path and the tables are always a
// materialisation of `messages_crdt` (AGENTS.md → Sync).
//
// Async on purpose: expo-sqlite's synchronous API needs SharedArrayBuffer on
// the web, which exists only on a cross-origin-isolated page — and Expo's dev
// server does not isolate the HTML document, nor does every static host. The
// async API works everywhere, so core awaits the adapter instead.

const ADAPTERS = new WeakMap()

/**
 * The adapter for an open expo-sqlite database. One per database, because
 * core's clock cache is keyed on the adapter object it is handed.
 * @returns {import("@dotbook/core/sync").SyncDb}
 */
export function adapterFor(db) {
	let adapter = ADAPTERS.get(db)
	if (!adapter) {
		adapter = adapt(db)
		ADAPTERS.set(db, adapter)
	}
	return adapter
}

function adapt(db) {
	// One transaction at a time, as the server's adapter does. withTransactionAsync
	// is a bare BEGIN … COMMIT on the one shared connection, so two at once (an
	// import while the foreground sync runs) interleave: the second BEGIN fails and
	// its ROLLBACK undoes the first. A queue makes each wait its turn.
	let queue = Promise.resolve()
	function transaction(fn) {
		const turn = queue.then(async () => {
			// withTransactionAsync resolves to nothing, so the result is carried out by hand.
			let result
			await db.withTransactionAsync(async () => {
				result = await fn()
			})
			return result
		})
		// The next caller waits for this one to finish, however it finished.
		queue = turn.catch(() => undefined)
		return turn
	}
	return {
		run: (sql, params = []) => db.runAsync(sql, params),
		all: (sql, params = []) => db.getAllAsync(sql, params),
		get: (sql, params = []) => db.getFirstAsync(sql, params),
		transaction,
	}
}

/**
 * Create `row` in `dataset` — the full row, keys included, every synced column.
 * @param {string} dataset  a key of SYNCED
 */
export async function insertRow(db, dataset, row) {
	const adapter = adapterFor(db)
	await applyMessages(adapter, await messagesForInsert(adapter, dataset, row))
}

/**
 * Change `changes` on one row. `key` is `{ id }`, or every key column for a
 * composite key (`todo_links`: `{ todo_id, entry_id }`).
 */
export async function updateRow(db, dataset, key, changes) {
	const adapter = adapterFor(db)
	await applyMessages(adapter, await messagesForUpdate(adapter, dataset, key, changes))
}
