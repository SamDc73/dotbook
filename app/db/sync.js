import { applyMessages, messagesForInsert, messagesForUpdate } from "@dotbook/core/sync"

// The app's side of @dotbook/core/sync: expo-sqlite's synchronous API behind the
// four-method adapter core expects, and the two helpers every write to a synced
// table goes through. A write becomes messages first and a table row second, so
// local and foreign writes travel one path and the tables are always a
// materialisation of `messages_crdt` (AGENTS.md → Sync).
//
// On web the synchronous API blocks on SharedArrayBuffer, which browsers allow
// only under the COOP/COEP headers metro.config.js (dev) and the Caddyfile
// (self-host) send.

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
	return {
		run: (sql, params = []) => db.runSync(sql, params),
		all: (sql, params = []) => db.getAllSync(sql, params),
		get: (sql, params = []) => db.getFirstSync(sql, params),
		// withTransactionSync returns nothing, so the result is carried out by hand.
		transaction: (fn) => {
			let result
			db.withTransactionSync(() => {
				result = fn()
			})
			return result
		},
	}
}

/**
 * Create `row` in `dataset` — the full row, keys included, every synced column.
 * @param {string} dataset  a key of SYNCED
 */
export async function insertRow(db, dataset, row) {
	const adapter = adapterFor(db)
	applyMessages(adapter, messagesForInsert(adapter, dataset, row))
}

/**
 * Change `changes` on one row. `key` is `{ id }`, or every key column for a
 * composite key (`todo_links`: `{ todo_id, entry_id }`).
 */
export async function updateRow(db, dataset, key, changes) {
	const adapter = adapterFor(db)
	applyMessages(adapter, messagesForUpdate(adapter, dataset, key, changes))
}
