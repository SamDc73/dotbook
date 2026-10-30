// Timers on the server — the web client's half of app/db/timers.js. A timer is a
// row, not runtime state (AGENTS.md → "Timers are rows"): `kind: timer` with
// ts_start and ts_end, so remaining time is always `ts_end - now`, read back
// from the log. Writes go through publish/publishUpdate so they sync.
//
// No notifications are scheduled here: a timer's end rings on the person's
// devices, which schedule their own (app/notifications). The server only writes
// the row, exactly as the phone does.

import { parseLineTime } from "@dotbook/core/parse"
import { renderLine } from "@dotbook/core/recurrence"
import { uuidv7 } from "uuidv7"
import { publish, publishUpdate } from "../sync/publish.js"
import { today, zone } from "../wallClock.js"

const MINUTE_MS = 60 * 1000
// A block that starts in under this is not worth a timer; offer the next one.
const TOO_SOON_MS = 2 * MINUTE_MS

/**
 * Start a timer for `minutes` from now. `todoId` links the time to that todo, as
 * the app's `linkTimerToActiveTodo` does for its active one — and only while the
 * todo is open.
 *
 * @returns {Promise<object>} the new timer row
 */
export async function startTimer(db, groupId, { day, text, minutes, todoId = null }, now = Date.now()) {
	const onDay = day ?? today(now)
	const row = {
		id: uuidv7(),
		day: onDay,
		seq: await nextSeq(db, onDay),
		ts_start: now,
		ts_end: now + minutes * MINUTE_MS,
		text: text.trim(),
		kind: "timer",
		source: "web",
		created_at: now,
		deleted_at: null,
	}
	await publish(db, groupId, "entries", [row])
	if (todoId !== null) {
		await linkToTodo(db, groupId, todoId, row.id, now)
	}
	return row
}

/** Completing writes ts_end as it actually happened (app/db/timers.js `stopTimer`). */
export async function stopTimer(db, groupId, id, now = Date.now()) {
	const timer = await timerRow(db, id)
	await publishUpdate(db, groupId, "entries", { id }, { ts_end: now })
	return timer
}

/** Abandoning is a soft delete, not a silent disappearance. */
export async function abandonTimer(db, groupId, id, now = Date.now()) {
	const timer = await timerRow(db, id)
	await publishUpdate(db, groupId, "entries", { id }, { deleted_at: now })
	return timer
}

/** Undo for `abandonTimer`: the same row, live again. Its end is unchanged. */
export async function restoreTimer(db, groupId, id) {
	const timer = await timerRow(db, id)
	await publishUpdate(db, groupId, "entries", { id }, { deleted_at: null })
	return timer
}

/**
 * The running timer, or null: started, not yet over, not abandoned. The same
 * SELECT app/db/blocks.js `activeCountdown` uses.
 */
export function activeTimer(db, now = Date.now()) {
	return db.get(
		`SELECT * FROM entries WHERE kind = 'timer' AND ts_start <= ? AND ts_end > ? AND deleted_at IS NULL
		ORDER BY ts_start DESC LIMIT 1`,
		[now, now]
	)
}

/**
 * Durations worth offering, never demanded (app/db/timers.js `suggestions`): the
 * next plan block's remaining minutes first, then the length you usually pick.
 * Plain SQL over the log; a suggestion is shown, never applied.
 */
export async function suggestions(db, now = Date.now(), day = today(now)) {
	const offered = []
	const block = await nextPlanBlock(db, day, now)
	if (block) {
		offered.push(blockSuggestion(block, Math.ceil((block.ts_start - now) / MINUTE_MS)))
	}
	const usual = await usualMinutes(db)
	if (usual !== null && usual !== offered[0]?.minutes) {
		offered.push({ minutes: usual, label: `${usual} min — your usual` })
	}
	return offered
}

// `25 min — until write report at 2:00 pm` — the plan block's own words, and the
// time core's `renderLine` writes (the server has no app `clock` to import).
function blockSuggestion(block, minutes) {
	const until = parseLineTime(block.text, block.day).body
	const at = renderLine("", block.ts_start, null, zone()).trim()
	return { minutes, label: `${minutes} min — until ${until} at ${at}` }
}

async function timerRow(db, id) {
	const row = await db.get("SELECT * FROM entries WHERE id = ? AND kind = 'timer'", [id])
	if (!row) {
		throw new Error(`No timer with id ${id} — read the day again for current ids.`)
	}
	return row
}

async function nextSeq(db, day) {
	const { next } = await db.get("SELECT coalesce(max(seq), 0) + 1 AS next FROM entries WHERE day = ?", [day])
	return next
}

// One tap, no thought — but only onto a todo that is still open.
async function linkToTodo(db, groupId, todoId, entryId, now) {
	const open = await db.get("SELECT 1 FROM todos WHERE id = ? AND status = 'open' AND deleted_at IS NULL", [todoId])
	if (!open) {
		return
	}
	const exists = await db.get("SELECT 1 FROM todo_links WHERE todo_id = ? AND entry_id = ?", [todoId, entryId])
	if (exists) {
		return
	}
	await publish(db, groupId, "todo_links", [{ todo_id: todoId, entry_id: entryId, origin: "timer", confirmed_at: now }])
}

// The next plan block of the day being viewed. If it starts in under two
// minutes, the one after it — a 90-second timer helps nobody.
async function nextPlanBlock(db, day, now) {
	const blocks = await db.all(
		`SELECT * FROM entries WHERE day = ? AND kind = 'plan' AND deleted_at IS NULL AND ts_start > ?
		ORDER BY ts_start LIMIT 2`,
		[day, now]
	)
	const soon = blocks[0] && blocks[0].ts_start - now < TOO_SOON_MS
	return (soon ? blocks[1] : blocks[0]) ?? null
}

// Your most frequent past timer length, most recent breaking ties. Plain SQL over the log.
async function usualMinutes(db) {
	const row = await db.get(
		`SELECT round((ts_end - ts_start) / 60000.0) AS minutes FROM entries
		WHERE kind = 'timer' AND deleted_at IS NULL AND ts_end > ts_start
		GROUP BY minutes ORDER BY count(*) DESC, max(created_at) DESC LIMIT 1`
	)
	return row ? Number(row.minutes) : null
}
