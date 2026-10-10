// Merging messages into a device and materialising them into the tables.
//
// Last-write-wins per field: for each (dataset, row, column) the value in the
// table is the value of the newest message. Timestamps are hybrid logical
// clocks, so "newest" is causal order, not wall-clock luck.

import { merkle, Timestamp } from "@actual-app/crdt"
import { reloadClock, saveClock, withClock } from "./clock.js"
import { keyValues, SYNCED } from "./tables.js"

/**
 * Merge `messages` — our own fresh ones or a server's — into `db`.
 * Idempotent: a timestamp already stored is skipped, so replaying a whole sync
 * response is safe. Runs in one transaction: a message that cannot be
 * materialised (see `materialise`) rolls the batch back and surfaces, rather
 * than leaving a half-applied state behind.
 *
 * @param {import("./index.js").SyncDb} db
 * @param {{ timestamp: string, dataset: string, row: string, column: string, value: unknown }[]} messages
 * @returns {Promise<number>} how many messages were new
 */
export function applyMessages(db, messages) {
	return withClock(db, async (clock) => {
		try {
			return await mergeAll(db, clock, messages)
		} catch (error) {
			// The batch rolled back; so must the clock that counted it.
			await reloadClock(db)
			throw error
		}
	})
}

function mergeAll(db, clock, messages) {
	return db.transaction(async () => {
		const fresh = []
		for (const message of messages) {
			if (!(await db.get("SELECT 1 FROM messages_crdt WHERE timestamp = ?", [message.timestamp]))) {
				fresh.push(message)
			}
		}
		// Causal order, so a row's insert lands before edits to it.
		fresh.sort((a, b) => a.timestamp.localeCompare(b.timestamp))

		for (const message of fresh) {
			await db.run("INSERT INTO messages_crdt (timestamp, dataset, row, column, value) VALUES (?, ?, ?, ?, ?)", [
				message.timestamp,
				message.dataset,
				message.row,
				message.column,
				JSON.stringify(message.value),
			])
			const timestamp = Timestamp.parse(message.timestamp)
			clock.merkle = merkle.insert(clock.merkle, timestamp)
			// Move our clock past every message we take in, so nothing we stamp
			// later can sort before something we have already seen.
			Timestamp.recv(timestamp)
		}

		for (const [dataset, row, columns] of touchedRows(fresh)) {
			await materialise(db, dataset, row, columns)
		}
		await saveClock(db)
		return fresh.length
	})
}

/**
 * Rebuild every synced table row from `messages_crdt`. The tables are a cache
 * of the messages; this is what makes that true. Run it after a migration adds
 * a dataset this device did not know when the messages arrived.
 */
export async function rebuildFromMessages(db) {
	await db.transaction(async () => {
		for (const { dataset, row } of await db.all("SELECT DISTINCT dataset, row FROM messages_crdt")) {
			if (SYNCED[dataset]) {
				await materialise(db, dataset, row, SYNCED[dataset].columns)
			}
		}
	})
}

/** `[dataset, row, columns[]]` for every row the batch touched. */
function touchedRows(messages) {
	const rows = new Map()
	for (const { dataset, row, column } of messages) {
		const id = `${dataset} ${row}`
		if (!rows.has(id)) {
			rows.set(id, [dataset, row, new Set()])
		}
		rows.get(id)[2].add(column)
	}
	return [...rows.values()].map(([dataset, row, columns]) => [dataset, row, [...columns]])
}

/**
 * Write the newest value of each of `columns` into the table, creating the row
 * if needed. A dataset or column this build does not know is left in
 * `messages_crdt` and skipped; `rebuildFromMessages` picks it up after the
 * upgrade that adds it.
 *
 * UPDATE or INSERT rather than an upsert: SQLite checks NOT NULL before it
 * looks for a key conflict, so an upsert carrying one column would fail on an
 * existing row. A brand-new row with a NOT NULL column still missing does fail
 * here — that can only happen if a row's creating messages were split up,
 * which `messagesForInsert` never does and the relay never reorders (it
 * returns causal order) — so that failure is a real bug surfacing, not a case
 * to paper over.
 */
async function materialise(db, dataset, row, columns) {
	const table = SYNCED[dataset]
	if (!table) {
		return
	}
	const names = []
	const values = []
	for (const column of columns.filter((c) => table.columns.includes(c))) {
		const newest = await db.get(
			"SELECT value FROM messages_crdt WHERE dataset = ? AND row = ? AND column = ? ORDER BY timestamp DESC LIMIT 1",
			[dataset, row, column]
		)
		if (newest) {
			names.push(column)
			values.push(JSON.parse(newest.value))
		}
	}
	if (names.length === 0) {
		return
	}

	const whereKey = table.keys.map((key) => `${key} = ?`).join(" AND ")
	const keys = keyValues(row)
	if (await db.get(`SELECT 1 FROM ${dataset} WHERE ${whereKey}`, keys)) {
		const assignments = names.map((column) => `${column} = ?`).join(", ")
		await db.run(`UPDATE ${dataset} SET ${assignments} WHERE ${whereKey}`, [...values, ...keys])
		return
	}
	const all = [...table.keys, ...names]
	const placeholders = all.map(() => "?").join(", ")
	await db.run(`INSERT INTO ${dataset} (${all.join(", ")}) VALUES (${placeholders})`, [...keys, ...values])
}
