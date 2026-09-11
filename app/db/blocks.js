import { parseLineTime } from "@dotbook/core/parse"

// What the focus view counts down: the running timer if there is one, else the
// plan block you are inside right now. Both are ordinary `entries` rows — the
// countdown is always `ts_end - now` read back from the row, never a number
// held in memory (AGENTS.md → "Timers are rows").
//
// Both functions return an array of at most one row, so `useLiveQuery`'s
// initial `[]` and a real "nothing" look the same to the screen: `rows[0]`.

/** @returns {Promise<{ kind: string, title: string, ts_start: number, ts_end: number }[]>} */
export async function activeCountdown(db, now) {
	const timers = await db.sql`SELECT * FROM entries
		WHERE kind = 'timer' AND ts_start <= ${now} AND ts_end > ${now} AND deleted_at IS NULL
		ORDER BY ts_start DESC LIMIT 1`
	if (timers.length > 0) {
		return timers.map(withTitle)
	}
	const blocks = await db.sql`SELECT * FROM entries
		WHERE kind = 'plan' AND ts_start <= ${now} AND ts_end > ${now} AND deleted_at IS NULL
		ORDER BY ts_start DESC LIMIT 1`
	return blocks.map(withTitle)
}

/** The next plan block starting after `now`, today. */
export async function upNext(db, now, day) {
	const blocks = await db.sql`SELECT * FROM entries
		WHERE kind = 'plan' AND day = ${day} AND ts_start > ${now} AND deleted_at IS NULL
		ORDER BY ts_start ASC LIMIT 1`
	return blocks.map(withTitle)
}

// The line minus its time prefix — `12:00 -> 12:30 Praxology` reads as `Praxology`.
function withTitle(row) {
	return { ...row, title: parseLineTime(row.text, row.day).body }
}
