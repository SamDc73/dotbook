// The server's wall clock: the zone it reads days and times in, and the one
// way it writes a time into a line.
//
// The zone is the process's own, so the core parser (which builds dates with
// the runtime's local zone) and everything here agree. Set `TZ` in `.env` to the
// zone you live in — otherwise "today" and `7:36 am` are UTC's.

import { TZDate } from "@date-fns/tz"
import { localDay } from "@dotbook/core/parse"
import { renderLine } from "@dotbook/core/recurrence"

export function zone() {
	return Intl.DateTimeFormat().resolvedOptions().timeZone
}

export function today(now = Date.now()) {
	return localDay(now)
}

/**
 * `7:36 am done: write report` — a time written into a line the way the app
 * writes one (app/lib/format.js `clock`). Core's `renderLine` is the server's
 * only clock writer; it cannot import the app.
 */
export function stamped(text, ts) {
	return renderLine(text, ts, null, zone())
}

/** `2026-10-05T07:36:00.000+02:00` — an instant as an AI tool reads it; null stays null. */
export function isoLocal(ts) {
	return ts === null ? null : new TZDate(ts, zone()).toISOString()
}

/** `2026-10-05` + 1 → `2026-10-06`. `Date` carries the overflow across months. */
export function shiftDay(day, delta) {
	const [year, month, date] = day.split("-").map(Number)
	return localDay(new Date(year, month - 1, date + delta).getTime())
}

/** Epoch ms of local midnight at the start of `day`. */
export function midnight(day) {
	const [year, month, date] = day.split("-").map(Number)
	return new Date(year, month - 1, date).getTime()
}
