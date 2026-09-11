import { parseRingconnCsv } from "@dotbook/core/import"
import { uuidv7 } from "uuidv7"
import { insertRow, updateRow } from "./sync"

// RingConn CSV → the observation tables, through the sync helpers (the tables
// sync, so core's direct-SQL upsert is not used here). Parsing and the column
// mapping live in @dotbook/core/import; this file only decides insert, update,
// or skip for each row.
//
// Gap-filling, never overwriting: a row a person entered (`source = 'manual'`)
// is left alone, and so is a row the file would not change — a re-import of an
// overlapping export is idempotent and sends no messages for what other
// devices already hold. Only the columns that differ become an update.

/**
 * @param {string} text  the whole file
 * @param {string} tzid  the zone the ring app exported in
 * @returns {Promise<{ kind: "activity"|"sleep"|"vitals"|null, inserted: number, updated: number, skipped: number }>}
 *   `skipped` counts rows left alone: manual ones, and ones already identical
 */
export async function importRingconn(db, text, tzid) {
	const { kind, rows } = parseRingconnCsv(text, { tzid })
	const counts = { kind, inserted: 0, updated: 0, skipped: 0 }
	if (kind === null) {
		return counts
	}

	for (const row of rows) {
		const found = await existing(db, kind, row)
		if (found) {
			const changes = found.source === "manual" ? {} : changed(measurements(kind, row), found.row)
			if (Object.keys(changes).length === 0) {
				counts.skipped++
				continue
			}
			await updateRow(db, TABLE[kind], found.key, changes)
			counts.updated++
			continue
		}
		await insertRow(db, TABLE[kind], { ...idFor(kind), ...row, created_at: Date.now() })
		counts.inserted++
	}
	return counts
}

const TABLE = { sleep: "sleep_sessions", vitals: "daily_vitals", activity: "daily_activity" }

// The natural key of each export: a sleep session by its start, the day files
// by their day. `key` is what updateRow addresses the row by.
async function existing(db, kind, row) {
	if (kind === "sleep") {
		const found = await db.sql`SELECT * FROM sleep_sessions WHERE start_ts = ${row.start_ts}`.first()
		return found && { key: { id: found.id }, source: found.source, row: found }
	}
	const found =
		kind === "vitals"
			? await db.sql`SELECT * FROM daily_vitals WHERE day = ${row.day}`.first()
			: await db.sql`SELECT * FROM daily_activity WHERE day = ${row.day}`.first()
	return found && { key: { day: row.day }, source: found.source, row: found }
}

// Everything the file measured plus where it came from; the natural key and
// `created_at` stay as first written.
function measurements(kind, row) {
	const natural = kind === "sleep" ? "start_ts" : "day"
	const { [natural]: _key, ...rest } = row
	return rest
}

// The subset of `next` that differs from what is stored.
function changed(next, stored) {
	const diff = {}
	for (const [column, value] of Object.entries(next)) {
		if (stored[column] !== value) diff[column] = value
	}
	return diff
}

// Only sleep sessions carry a UUID; the day tables are keyed by the day itself.
function idFor(kind) {
	return kind === "sleep" ? { id: uuidv7() } : {}
}
