import { extractItems, localDay, parseLineTime } from "@dotbook/core/parse"
import { uuidv7 } from "uuidv7"
import { recordUse } from "./templates"

// Every function here takes the open expo-sqlite database first.
// `db.sql` is expo-sqlite's tagged template: values are bound, never concatenated.

// A day's lines with their template use, if any. `snapshot`/`deviation` come back parsed.
export async function entriesForDay(db, day, order) {
	const rows = await db.sql`SELECT e.*, u.snapshot, u.deviation, t.name AS template_name, v.label AS version_label
		FROM entries e
		LEFT JOIN template_uses u ON u.entry_id = e.id
		LEFT JOIN templates t ON t.id = u.template_id
		LEFT JOIN template_versions v ON v.id = u.version_id
		WHERE e.day = ${day} AND e.deleted_at IS NULL
		ORDER BY e.seq`
	const entries = rows.map(parseUse)
	if (order === "chronological") {
		entries.sort(byTime)
	}
	return entries
}

// Timed lines by their time; untimed lines after them. A stable sort keeps typing order for ties.
function byTime(a, b) {
	if (a.ts_start === null || b.ts_start === null) {
		return (a.ts_start === null) - (b.ts_start === null)
	}
	return a.ts_start - b.ts_start
}

function parseUse(row) {
	if (row.snapshot === null) {
		return row
	}
	return { ...row, snapshot: JSON.parse(row.snapshot), deviation: row.deviation && JSON.parse(row.deviation) }
}

// Plan vs log needs no toggle: a line whose time has not happened yet is a plan.
// A timed line is a plan when it starts in the future, an untimed one when its
// day is after today. Editing the text derives the kind again; `confirmPlan`
// turns a past plan into a log. One rule, easy to flip if it proves wrong.
// (Reminders at a plan's mark: see app/notifications.)
function kindFor(parsed, now) {
	if (parsed.tsStart !== null) {
		return parsed.tsStart > now ? "plan" : "log"
	}
	return parsed.day > localDay(now) ? "plan" : "log"
}

// `day` is the day being viewed; a natural prefix (`ytd 9pm …`) may land the line elsewhere.
// `source` says where the line came from — `manual` when typed, `voice` when transcribed.
export async function addEntry(db, { day, text, source = "manual" }) {
	const now = Date.now()
	const parsed = parseLineTime(text, day, now)
	const id = uuidv7()
	const { next } = await db.sql`SELECT coalesce(max(seq), 0) + 1 AS next FROM entries WHERE day = ${parsed.day}`.first()
	await db.sql`INSERT INTO entries (id, day, seq, ts_start, ts_end, text, kind, source, created_at)
		VALUES (${id}, ${parsed.day}, ${next}, ${parsed.tsStart}, ${parsed.tsEnd}, ${text}, ${kindFor(parsed, now)}, ${source}, ${now})`
	await annotate(db, id, parsed)
	return id
}

export async function updateEntryText(db, id, text, day) {
	const now = Date.now()
	const parsed = parseLineTime(text, day, now)
	await db.sql`UPDATE entries SET text = ${text}, day = ${parsed.day}, ts_start = ${parsed.tsStart},
		ts_end = ${parsed.tsEnd}, kind = ${kindFor(parsed, now)} WHERE id = ${id}`
	await annotate(db, id, parsed)
}

// "Did it?" — a plan line becomes a log line when you confirm what happened.
export function confirmPlan(db, id) {
	return db.sql`UPDATE entries SET kind = 'log' WHERE id = ${id}`
}

// Everything derived from a line: quantities, durations, tags (a cache, so
// replace-all is right) and the template use. The text itself is never rewritten.
async function annotate(db, id, { day, body }) {
	await db.sql`DELETE FROM entry_items WHERE entry_id = ${id}`
	for (const item of extractItems(body)) {
		await db.sql`INSERT INTO entry_items (id, entry_id, name, qty, unit, extractor, confidence)
			VALUES (${uuidv7()}, ${id}, ${item.name}, ${item.qty}, ${item.unit}, ${item.extractor}, ${item.confidence})`
	}
	await recordUse(db, { id, day, body })
}

// Soft delete: the row stays so it can still sync and be audited.
export async function deleteEntry(db, id) {
	await db.sql`UPDATE entries SET deleted_at = ${Date.now()} WHERE id = ${id}`
}
