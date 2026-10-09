// Passive data — what arrived without being typed: the ring's sleep, vitals and
// activity, and screen time. Read only; the server takes these in through
// sync and the browser-time endpoint, never through the MCP endpoint.

import { midnight, shiftDay } from "../wallClock.js"

/** Sleep sessions that ended (you woke) within `from`…`to`, oldest first. */
export function sleepSessions(db, from, to) {
	return db.all("SELECT * FROM sleep_sessions WHERE end_ts >= ? AND end_ts < ? ORDER BY end_ts", [
		midnight(from),
		midnight(shiftDay(to, 1)),
	])
}

export function dailyVitals(db, from, to) {
	return db.all("SELECT * FROM daily_vitals WHERE day BETWEEN ? AND ? ORDER BY day", [from, to])
}

export function dailyActivity(db, from, to) {
	return db.all("SELECT * FROM daily_activity WHERE day BETWEEN ? AND ? ORDER BY day", [from, to])
}

/**
 * Seconds per key over the range, most first, summed across devices — apps
 * (android:usagestats, by package) and sites (ext:firefox, by host) apart.
 * The double-count rule: sites are a breakdown of the browser app's own time,
 * so the two lists must never be added together.
 */
export async function screenTime(db, from, to) {
	const rows = await db.all(
		`SELECT source, key, sum(seconds) AS seconds FROM time_rollups
		WHERE day BETWEEN ? AND ? GROUP BY source, key ORDER BY seconds DESC`,
		[from, to]
	)
	const pick = (source) => rows.filter((row) => row.source === source).map(({ key, seconds }) => ({ key, seconds }))
	return { apps: pick("android:usagestats"), sites: pick("ext:firefox") }
}
