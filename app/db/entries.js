import { parseLineTime } from "@dotbook/core/parse"
import { uuidv7 } from "uuidv7"

// Every function here takes the open expo-sqlite database first.
// `db.sql` is expo-sqlite's tagged template: values are bound, never concatenated.

export function entriesForDay(db, day, order) {
	if (order === "chronological") {
		return db.sql`SELECT * FROM entries WHERE day = ${day} AND deleted_at IS NULL
			ORDER BY ts_start IS NULL, ts_start, seq`
	}
	return db.sql`SELECT * FROM entries WHERE day = ${day} AND deleted_at IS NULL ORDER BY seq`
}

export async function addEntry(db, { day, text }) {
	const { tsStart, tsEnd } = parseLineTime(text, day)
	const { next } = await db.sql`SELECT coalesce(max(seq), 0) + 1 AS next FROM entries WHERE day = ${day}`.first()
	await db.sql`INSERT INTO entries (id, day, seq, ts_start, ts_end, text, created_at)
		VALUES (${uuidv7()}, ${day}, ${next}, ${tsStart}, ${tsEnd}, ${text}, ${Date.now()})`
}

export async function updateEntryText(db, id, text, day) {
	const { tsStart, tsEnd } = parseLineTime(text, day)
	await db.sql`UPDATE entries SET text = ${text}, ts_start = ${tsStart}, ts_end = ${tsEnd} WHERE id = ${id}`
}

// Soft delete: the row stays so it can still sync and be audited.
export async function deleteEntry(db, id) {
	await db.sql`UPDATE entries SET deleted_at = ${Date.now()} WHERE id = ${id}`
}
