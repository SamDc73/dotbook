import { extractItems, lineKind, localDay, parseLineTime } from "@dotbook/core/parse"
import { uuidv7 } from "uuidv7"
import { clock } from "../lib/format"
import { insertRow, updateRow } from "./sync"
import { recordUse } from "./templates"

// Every function here takes the open expo-sqlite database first.
// Reads are `db.sql` tagged templates: values are bound, never concatenated.
// Writes to `entries` go through insertRow/updateRow (db/sync.js) so they sync.

// A day's lines with their template use, if any. `snapshot`/`deviation` come back parsed.
// Two devices can hand out the same seq offline; the id breaks that tie the same way everywhere.
// `todo_role` / `todo_status` / `todo_text`: set when the line said something
// about a todo in so many words (`started`, `finished`, `trashed` — see
// todos.js applyTodoIntent), so the log can draw it as that todo's row.
export async function entriesForDay(db, day, order) {
	const rows = await db.sql`SELECT e.*, u.snapshot, u.deviation, t.name AS template_name, v.label AS version_label,
			tl.origin AS todo_role, td.status AS todo_status, td.text AS todo_text
		FROM entries e
		LEFT JOIN template_uses u ON u.entry_id = e.id
		LEFT JOIN templates t ON t.id = u.template_id
		LEFT JOIN template_versions v ON v.id = u.version_id
		LEFT JOIN todo_links tl ON tl.entry_id = e.id AND tl.origin IN ('started', 'finished', 'trashed')
			AND tl.confirmed_at IS NOT NULL
		LEFT JOIN todos td ON td.id = tl.todo_id
		WHERE e.day = ${day} AND e.deleted_at IS NULL
		ORDER BY e.seq, e.id`
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

// Plan vs log needs no toggle: `lineKind` (@dotbook/core/parse) — a line whose
// time has not happened yet is a plan. It lives in core because the server's MCP
// endpoint writes lines too. Editing the text derives the kind again;
// `confirmPlan` turns a past plan into a log.
// (Reminders at a plan's mark: see app/notifications.)

// `day` is the day being viewed; a natural prefix (`ytd 9pm …`) may land the line elsewhere.
// `source` says where the line came from — `manual` when typed, `voice` when transcribed.
// `stampedAt`: the moment the app wrote the time into `text` itself because the
// line was typed without one. Null when the person typed it. Kept, not shown.
// `kind` overrides the time rule — `/plan` says "this is a plan" whatever the clock.
export async function addEntry(db, { day, text, source = "manual", stampedAt = null, kind = null }) {
	const now = Date.now()
	const parsed = parseLineTime(text, day, now)
	const id = uuidv7()
	const { next } = await db.sql`SELECT coalesce(max(seq), 0) + 1 AS next FROM entries WHERE day = ${parsed.day}`.first()
	await insertRow(db, "entries", {
		id,
		day: parsed.day,
		seq: next,
		ts_start: parsed.tsStart,
		ts_end: parsed.tsEnd,
		text,
		kind: kind ?? lineKind(parsed, now),
		source,
		created_at: now,
		deleted_at: null,
		stamped_at: stampedAt,
	})
	await annotate(db, id, parsed)
	return id
}

export async function updateEntryText(db, id, text, day) {
	const now = Date.now()
	const parsed = parseLineTime(text, day, now)
	const changes = { text, day: parsed.day, ts_start: parsed.tsStart, ts_end: parsed.tsEnd, kind: lineKind(parsed, now) }
	// A stamped time the person has now edited is their time: the stamp is over.
	const before = await db.sql`SELECT text, stamped_at FROM entries WHERE id = ${id}`.first()
	if (before?.stamped_at !== null && parseLineTime(before.text, day, now).timeText !== parsed.timeText) {
		changes.stamped_at = null
	}
	await updateRow(db, "entries", { id }, changes)
	await annotate(db, id, parsed)
}

// A line typed today without a time is stamped with the current one — the time
// is the bullet, so every line gets one. Written into the text itself, exactly
// as if typed, so the row stays a plain line; `stampedAt` remembers the app did
// it (kept, not shown). Other days and `/` commands are left alone.
export function stampedNow(text, day, now = Date.now()) {
	if (text.startsWith("/") || day !== localDay(now) || parseLineTime(text, day, now).timeText !== "") {
		return { text, stampedAt: null }
	}
	return { text: `${clock(now)} ${text}`, stampedAt: now }
}

// "Did it?" — a plan line becomes a log line when you confirm what happened.
export function confirmPlan(db, id) {
	return updateRow(db, "entries", { id }, { kind: "log" })
}

// Everything derived from a line: quantities, durations, tags, and the template
// use. The text itself is never rewritten.
async function annotate(db, id, { day, body }) {
	await extractInto(db, id, body)
	await recordUse(db, { id, day, body })
}

// `entry_items` is a derived cache and does not sync, so replace-all is right.
async function extractInto(db, id, body) {
	await db.sql`DELETE FROM entry_items WHERE entry_id = ${id}`
	for (const item of extractItems(body)) {
		await db.sql`INSERT INTO entry_items (id, entry_id, name, qty, unit, extractor, confidence)
			VALUES (${uuidv7()}, ${id}, ${item.name}, ${item.qty}, ${item.unit}, ${item.extractor}, ${item.confidence})`
	}
}

// Lines that arrived by sync carry their template use already (template_uses
// syncs too); only the items cache is local to this device, so only it is rebuilt.
export async function reannotate(db, entryIds) {
	for (const id of entryIds) {
		const entry = await db.sql`SELECT text, day, deleted_at FROM entries WHERE id = ${id}`.first()
		if (!entry || entry.deleted_at !== null) {
			await db.sql`DELETE FROM entry_items WHERE entry_id = ${id}`
			continue
		}
		await extractInto(db, id, parseLineTime(entry.text, entry.day).body)
	}
}

// Soft delete: the row stays so it can still sync and be audited.
export function deleteEntry(db, id) {
	return updateRow(db, "entries", { id }, { deleted_at: Date.now() })
}

// Undo for deleteEntry: the same row, live again.
export function restoreEntry(db, id) {
	return updateRow(db, "entries", { id }, { deleted_at: null })
}
