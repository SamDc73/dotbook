import { occurrenceLines, recurrencesFromIcs, ruleFromParts } from "@dotbook/core/recurrence"
import { uuidv7 } from "uuidv7"
import { addEntry } from "./entries"
import { insertRow, updateRow } from "./sync"

// Recurring events: a rule is a row, its occurrences become ordinary lines.
// The rule text (RRULE) and its expansion live in @dotbook/core/recurrence so the
// phone and the server agree on every occurrence; this file only stores and reads.
// Rules and instances sync, so every write goes through insertRow / updateRow.

export function recurrences(db) {
	return db.sql`SELECT * FROM recurrences WHERE deleted_at IS NULL ORDER BY created_at`
}

// `parts` is the form's shape — see ruleFromParts in core. `durationMin` null = point event.
export function addRecurrence(db, { text, parts, durationMin, kind }) {
	const { rrule, dtstart } = ruleFromParts(parts)
	return insertRow(db, "recurrences", {
		id: uuidv7(),
		text: text.trim(),
		rrule,
		dtstart,
		tzid: parts.tzid,
		duration_min: durationMin,
		kind,
		source: "manual",
		created_at: Date.now(),
		deleted_at: null,
	})
}

// Soft delete: occurrences already written stay in the log — they happened, or were planned.
export function removeRecurrence(db, id) {
	return updateRow(db, "recurrences", { id }, { deleted_at: Date.now() })
}

// Editing retires the old rule and starts a new one. Days already materialised
// keep their lines (their instance rows point at the old rule), so a change to
// the series never rewrites the past.
export async function replaceRecurrence(db, id, fields) {
	await removeRecurrence(db, id)
	await addRecurrence(db, fields)
}

// A timetable export, so nothing in it is retyped. Repeating events become rules;
// one-off events are ordinary lines through addEntry (which decides plan vs log
// by its usual time rule), marked with where they came from.
export async function importIcs(db, text, tzid) {
	const { recurrences: rules, oneOffs } = recurrencesFromIcs(text, { tzid })
	for (const rule of rules) {
		await insertRow(db, "recurrences", {
			id: uuidv7(),
			...rule,
			source: "import:ics",
			created_at: Date.now(),
			deleted_at: null,
		})
	}
	for (const line of oneOffs) {
		const id = await addEntry(db, { day: line.day, text: line.text })
		await updateRow(db, "entries", { id }, { source: "import:ics" })
	}
	return { rules: rules.length, oneOffs: oneOffs.length }
}

// Auto-materialise: every occurrence of every rule on `day` becomes an entries
// row, once. `recurrence_instances` remembers which occurrences already have a
// line, so this is idempotent — and editing or soft-deleting that line later
// never regenerates it, because the instance row stays. Call it whenever a day
// is opened, before the log is read.
//
// No outer transaction: each insertRow runs its own, and SQLite does not nest
// them. The instance row is written right after its line, so a crash between
// the two costs at most one duplicate line on the next open — visible, not silent.
export async function materializeDay(db, day) {
	const rules = await recurrences(db)
	const lines = rules.flatMap((rule) => occurrenceLines(rule, day).map((line) => ({ ...line, recurrence_id: rule.id })))

	for (const line of lines) {
		const seen = await db.sql`SELECT 1 FROM recurrence_instances
			WHERE recurrence_id = ${line.recurrence_id} AND occurrence_ts = ${line.ts_start}`.first()
		if (seen) continue

		const id = uuidv7()
		const { next } = await db.sql`SELECT coalesce(max(seq), 0) + 1 AS next FROM entries WHERE day = ${line.day}`.first()
		await insertRow(db, "entries", {
			id,
			day: line.day,
			seq: next,
			ts_start: line.ts_start,
			ts_end: line.ts_end,
			text: line.text,
			kind: line.kind,
			source: "recurrence",
			created_at: Date.now(),
			deleted_at: null,
		})
		await insertRow(db, "recurrence_instances", {
			recurrence_id: line.recurrence_id,
			occurrence_ts: line.ts_start,
			entry_id: id,
		})
	}
}
