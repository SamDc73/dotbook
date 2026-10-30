// The server's half of app/db/blocks.js — same queries, same shape, so the
// focus view shows a browser what a phone shows. What the focus view counts
// down: the running timer if there is one, else the plan block you are inside
// right now. Both are ordinary `entries` rows — the countdown is always
// `ts_end - now` read back from the row (AGENTS.md → "Timers are rows").

import { parseLineTime } from "@dotbook/core/parse"

export async function activeCountdown(db, now) {
	const timer = await db.get(
		"SELECT * FROM entries WHERE kind = 'timer' AND ts_start <= ? AND ts_end > ? AND deleted_at IS NULL ORDER BY ts_start DESC LIMIT 1",
		[now, now]
	)
	if (timer) return [withTitle(timer)]
	const block = await db.get(
		"SELECT * FROM entries WHERE kind = 'plan' AND ts_start <= ? AND ts_end > ? AND deleted_at IS NULL ORDER BY ts_start DESC LIMIT 1",
		[now, now]
	)
	return block ? [withTitle(block)] : []
}

/** The next plan block starting after `now`, today. */
export async function upNext(db, now, day) {
	const block = await db.get(
		"SELECT * FROM entries WHERE kind = 'plan' AND day = ? AND ts_start > ? AND deleted_at IS NULL ORDER BY ts_start ASC LIMIT 1",
		[day, now]
	)
	return block ? [withTitle(block)] : []
}

// The line minus its time prefix — `12:00 -> 12:30 Praxology` reads as `Praxology`.
function withTitle(row) {
	return { ...row, title: parseLineTime(row.text, row.day).body }
}
