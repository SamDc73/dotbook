// Recurring events on the server — the MCP endpoint's half of what
// app/db/recurrences.js does on a device. The rule text and its expansion are
// @dotbook/core/recurrence, so the server and the phone agree on every occurrence.
//
// The server never materialises occurrences into lines: a device does that when
// it opens a day, and two writers materialising the same day would each write
// its own line. `pendingOccurrences` only shows what a day will hold.

import { occurrenceLines, partsFromRule, ruleFromParts } from "@dotbook/core/recurrence"
import { uuidv7 } from "uuidv7"
import { publish, publishUpdate } from "../sync/publish.js"
import { zone } from "../wallClock.js"
import { MCP_SOURCE } from "./entries.js"

export function recurrences(db) {
	return db.all("SELECT * FROM recurrences WHERE deleted_at IS NULL ORDER BY created_at")
}

/** Each live rule with its parts read back (freq, byDay, hour, minute, start day). */
export async function rulesWithParts(db) {
	const rows = await recurrences(db)
	return rows.map((row) => ({ ...row, parts: partsFromRule(row) }))
}

/**
 * `parts` is the app form's shape (see `ruleFromParts` in core), read in this
 * server's zone. `durationMin` null = a point event. @returns the new row, parts read back
 */
export async function addRecurrence(db, groupId, { text, parts, durationMin, kind }) {
	const tzid = zone()
	const { rrule, dtstart } = ruleFromParts({ ...parts, tzid })
	const row = {
		id: uuidv7(),
		text: text.trim(),
		rrule,
		dtstart,
		tzid,
		duration_min: durationMin,
		kind,
		source: MCP_SOURCE,
		created_at: Date.now(),
		deleted_at: null,
	}
	await publish(db, groupId, "recurrences", [row])
	return { ...row, parts: partsFromRule(row) }
}

/** Soft delete: lines already written for it stay — they happened, or were planned. */
export async function removeRecurrence(db, groupId, id) {
	const row = await db.get("SELECT * FROM recurrences WHERE id = ? AND deleted_at IS NULL", [id])
	if (!row) {
		throw new Error(`No recurring event with id ${id} — list them again for current ids.`)
	}
	await publishUpdate(db, groupId, "recurrences", { id }, { deleted_at: Date.now() })
	return row
}

/** Occurrences on `day` that no device has written into the log yet. */
export async function pendingOccurrences(db, day) {
	const pending = []
	for (const rule of await recurrences(db)) {
		for (const line of occurrenceLines(rule, day)) {
			const written = await db.get("SELECT 1 FROM recurrence_instances WHERE recurrence_id = ? AND occurrence_ts = ?", [
				rule.id,
				line.ts_start,
			])
			if (!written) pending.push({ ...line, recurrence_id: rule.id })
		}
	}
	return pending
}
