// Turning a local write into messages. One message = one column of one row.
//
// The caller applies the result with `applyMessages(db, messages)` at once, so
// local and foreign writes travel the one code path and the tables are always
// a materialisation of `messages_crdt`.

import { Timestamp } from "@actual-app/crdt"
import { saveClock, withClock } from "./clock.js"
import { rowKey, SYNCED } from "./tables.js"

/**
 * Messages that create `row` in `dataset` — every synced column, stamped in one
 * go. Travelling together is what lets a table with NOT NULL columns be
 * inserted from messages: the first messages for a row always carry all of it.
 *
 * @param {import("./index.js").SyncDb} db
 * @param {string} dataset  a key of SYNCED
 * @param {object} row      the full row, keys included
 */
export function messagesForInsert(db, dataset, row) {
	const key = rowKey(dataset, row)
	const fields = SYNCED[dataset].columns.map((column) => ({ dataset, row: key, column, value: row[column] ?? null }))
	return stamp(db, fields)
}

/**
 * Messages that change `changes` on the row addressed by `key`.
 *
 * @param {import("./index.js").SyncDb} db
 * @param {string} dataset
 * @param {object} key      `{ id }`, or every key column for a composite key
 * @param {object} changes  column → new value
 */
export function messagesForUpdate(db, dataset, key, changes) {
	const rowKeyText = rowKey(dataset, key)
	const fields = Object.entries(changes).map(([column, value]) => {
		if (!SYNCED[dataset].columns.includes(column)) {
			throw new Error(`${dataset}.${column} is not a synced column`)
		}
		return { dataset, row: rowKeyText, column, value }
	})
	return stamp(db, fields)
}

/** Give each field a fresh, monotonic timestamp from this device's clock. */
function stamp(db, fields) {
	return withClock(db, async () => {
		const messages = fields.map((field) => ({ ...field, timestamp: Timestamp.send().toString() }))
		await saveClock(db)
		return messages
	})
}
