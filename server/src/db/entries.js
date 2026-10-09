// The log's lines on the server — the MCP endpoint's half of what
// app/db/entries.js does on a device. Same parser, same plan/log rule, same
// stamp, same template snapshot, so a line written here differs from a typed
// one only in its `source`. Writes go through publish/publishUpdate so they sync.

import { lineKind, parseLineTime } from "@dotbook/core/parse"
import { uuidv7 } from "uuidv7"
import { publish, publishUpdate } from "../sync/publish.js"
import { stamped, today } from "../wallClock.js"
import { recordUse } from "./templates.js"

// Provenance (AGENTS.md → Sync): a line an AI tool wrote says so.
export const MCP_SOURCE = "mcp"

// A line with the template it named, if any.
const WITH_TEMPLATE = `SELECT e.*, t.name AS template_name, v.label AS version_label
	FROM entries e
	LEFT JOIN template_uses u ON u.entry_id = e.id
	LEFT JOIN templates t ON t.id = u.template_id
	LEFT JOIN template_versions v ON v.id = u.version_id`

/** A day's live lines: timed ones by their time, untimed after them, typing order within. */
export function entriesForDay(db, day) {
	return db.all(
		`${WITH_TEMPLATE} WHERE e.day = ? AND e.deleted_at IS NULL
		ORDER BY e.ts_start IS NULL, e.ts_start, e.seq, e.id`,
		[day]
	)
}

/** One line as it stands after a write, template included. */
function readEntry(db, id) {
	return db.get(`${WITH_TEMPLATE} WHERE e.id = ?`, [id])
}

/** Live lines whose text contains `query` (any case), newest first. */
export function searchEntries(db, { query, from, to, kind = null, limit }) {
	const pattern = `%${query.replace(/[\\%_]/g, "\\$&")}%`
	return db.all(
		`SELECT * FROM entries
		WHERE deleted_at IS NULL AND text LIKE ? ESCAPE '\\' AND day BETWEEN ? AND ? AND (? IS NULL OR kind = ?)
		ORDER BY day DESC, ts_start DESC, seq DESC LIMIT ?`,
		[pattern, from, to, kind, kind, limit]
	)
}

/** The live row, or an error the AI tool can act on. */
export async function liveEntry(db, id) {
	const row = await db.get("SELECT * FROM entries WHERE id = ? AND deleted_at IS NULL", [id])
	if (!row) {
		throw new Error(`No line with id ${id} — read the day again for current ids.`)
	}
	return row
}

/**
 * Add a line exactly as it would be typed: `7:36 took nootstack`,
 * `8:30 -> 10:00 deep work`, `ytd 9pm call with mum`. `kind: "plan"` makes it a
 * plan whatever the clock (the `/plan` command); otherwise its time decides.
 * A plain line typed today without a time is stamped with now — the composer's
 * rule (app/db/entries.js `stampedNow`): the time is the bullet, so every line
 * gets one. A plan is left as written, as `/plan` leaves it.
 * @returns the new line, template included
 */
export async function addEntry(db, groupId, { day, text, kind = null, source = MCP_SOURCE }, now = Date.now()) {
	const typed = text.trim()
	if (typed === "" || typed.startsWith("/")) {
		throw new Error("A line is plain text; `/` commands are the app's — use add_plan or add_todo.")
	}
	const stamp = kind === null && day === today(now) && parseLineTime(typed, day, now).timeText === ""
	const line = stamp ? stamped(typed, now) : typed
	const parsed = parseLineTime(line, day, now)
	const { next } = await db.get("SELECT coalesce(max(seq), 0) + 1 AS next FROM entries WHERE day = ?", [parsed.day])
	const row = {
		id: uuidv7(),
		day: parsed.day,
		seq: next,
		ts_start: parsed.tsStart,
		ts_end: parsed.tsEnd,
		text: line,
		kind: kind ?? lineKind(parsed, now),
		source,
		created_at: now,
		deleted_at: null,
		stamped_at: stamp ? now : null,
	}
	await publish(db, groupId, "entries", [row])
	await recordUse(db, groupId, { id: row.id, day: parsed.day, body: parsed.body })
	return readEntry(db, row.id)
}

/**
 * Replace a line's text — app/db/entries.js `updateEntryText`: the time and the
 * kind are read again, and a stamped time the text now changes is the person's.
 * A timer is a running countdown, not a line to retype; it is edited on a device.
 */
export async function editEntry(db, groupId, id, text, now = Date.now()) {
	const before = await liveEntry(db, id)
	if (before.kind === "timer") {
		throw new Error("That line is a timer; stop or abandon it on a device.")
	}
	const typed = text.trim()
	const parsed = parseLineTime(typed, before.day, now)
	const changes = {
		text: typed,
		day: parsed.day,
		ts_start: parsed.tsStart,
		ts_end: parsed.tsEnd,
		kind: lineKind(parsed, now),
	}
	if (before.stamped_at !== null && parseLineTime(before.text, before.day, now).timeText !== parsed.timeText) {
		changes.stamped_at = null
	}
	await publishUpdate(db, groupId, "entries", { id }, changes)
	await recordUse(db, groupId, { id, day: parsed.day, body: parsed.body })
	return readEntry(db, id)
}

/** "Did it?" — a plan line becomes a log line. */
export async function confirmPlan(db, groupId, id) {
	const row = await liveEntry(db, id)
	if (row.kind !== "plan") {
		throw new Error(`That line is a ${row.kind}, not a plan.`)
	}
	await publishUpdate(db, groupId, "entries", { id }, { kind: "log" })
	return readEntry(db, id)
}

/** Soft delete: the row stays so it can still sync and be audited. */
export async function deleteEntry(db, groupId, id) {
	const row = await liveEntry(db, id)
	await publishUpdate(db, groupId, "entries", { id }, { deleted_at: Date.now() })
	return row
}
