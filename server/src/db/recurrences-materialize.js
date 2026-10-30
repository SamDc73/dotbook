// A day's recurring events written into the log, once — app/db/recurrences.js
// `materializeDay`, on the server. The web client is thin: it opens a day and
// asks this to run first, so a browser sees the same recurring lines a phone
// would have written.
//
// The rule text and its expansion live in @dotbook/core/recurrence, so phone and
// server agree on every occurrence. `recurrence_instances` is what makes this
// idempotent: an occurrence with an instance row is never generated again, so
// editing or soft-deleting its line later changes only that day. Writes go
// through publish so they sync and reach every device.

import { occurrenceLines } from "@dotbook/core/recurrence"
import { uuidv7 } from "uuidv7"
import { publish } from "../sync/publish.js"

/**
 * Create the line for every occurrence of every live rule that falls on `day`.
 * Safe to call on every read of a day: an occurrence already written is skipped.
 *
 * No outer transaction: each publish applies its own messages, and SQLite does
 * not nest them. The instance row is written right after its line, so a crash
 * between the two costs at most one duplicate line on the next open — visible,
 * not silent.
 *
 * @returns {Promise<string[]>} the ids of the lines this call created
 */
export async function materializeDay(db, groupId, day, now = Date.now()) {
	const rules = await db.all("SELECT * FROM recurrences WHERE deleted_at IS NULL ORDER BY created_at")
	const lines = rules.flatMap((rule) => occurrenceLines(rule, day).map((line) => ({ ...line, recurrence_id: rule.id })))
	const created = []

	for (const line of lines) {
		const seen = await db.get("SELECT 1 FROM recurrence_instances WHERE recurrence_id = ? AND occurrence_ts = ?", [
			line.recurrence_id,
			line.ts_start,
		])
		if (seen) {
			continue
		}
		const id = uuidv7()
		const { next } = await db.get("SELECT coalesce(max(seq), 0) + 1 AS next FROM entries WHERE day = ?", [line.day])
		await publish(db, groupId, "entries", [
			{
				id,
				day: line.day,
				seq: next,
				ts_start: line.ts_start,
				ts_end: line.ts_end,
				text: line.text,
				kind: line.kind,
				source: "recurrence",
				created_at: now,
				deleted_at: null,
			},
		])
		await publish(db, groupId, "recurrence_instances", [
			{ recurrence_id: line.recurrence_id, occurrence_ts: line.ts_start, entry_id: id },
		])
		created.push(id)
	}
	return created
}
