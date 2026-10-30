import { api } from "../lib/api"
import { today } from "../lib/day"

// Web twin of db/blocks.js: what the focus view counts down — the running
// timer if there is one, else the plan block you are inside right now. Both
// are rows on the server; the countdown is always ts_end − now read back from
// the row, never a number held in memory. The `db` parameter is accepted and
// ignored, and so is `now`: the server answers with its own clock, which is
// the same minute for any real use.
//
// Both functions return an array of at most one row, so the screen's
// `rows[0]` and a real "nothing" look the same.

/** The active timer or plan block, today — `[]` when nothing is running. */
export async function activeCountdown(_db, _now) {
	const data = await api(`/api/v1/blocks?day=${encodeURIComponent(today())}`)
	return data.active ?? []
}

/** The next plan block starting after now, today — `[]` when none. */
export async function upNext(_db, _now, day) {
	const data = await api(`/api/v1/blocks?day=${encodeURIComponent(day)}`)
	return data.upNext ?? []
}
