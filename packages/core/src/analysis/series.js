// Daily series: one number per calendar day, aligned to a caller-supplied axis.
//
// Every function takes `days` (YYYY-MM-DD, ascending — the axis) and rows the
// caller already queried, and returns `{ days, values }` with `values[i]` for
// `days[i]`. `null` means "no observation that day", never 0: a day with no
// ring data and a day with zero steps are different facts, and the statistics
// in stats.js skip nulls while counting zeros.

import { effectiveTick } from "../habits/ticks.js"
import { fuzzyBest } from "../parse/fuzzy.js"
import { localDay } from "../parse/natural.js"
import { parseLineTime } from "../parse/time.js"

/**
 * Total quantity of one item per day — `caff` finds `caffeine`.
 * Unit-agnostic on purpose: V0.1 has no unit conversion, so a `200mg` day and a
 * `1g` day sum raw. Log one item in one unit and the series is right.
 *
 * @param {string[]} days
 * @param {{ entry_id: string, name: string, qty: number|null }[]} items  entry_items rows
 * @param {{ id: string, day: string }[]} entries  the entries those items belong to
 * @param {string} name  as typed; resolved once to the best-matching item name
 */
export function quantitySeries(days, items, entries, name) {
	const names = [...new Set(items.map((item) => item.name))]
	const target = fuzzyBest(name, names)
	const dayOf = new Map(entries.map((entry) => [entry.id, entry.day]))

	const totals = new Map()
	for (const item of items) {
		if (item.name !== target || item.qty === null) continue
		const day = dayOf.get(item.entry_id)
		if (day) add(totals, day, item.qty)
	}
	return aligned(days, totals)
}

/**
 * Lines per day whose body contains `pattern` (case-insensitive). A day with
 * lines but no match is 0; a day with no lines at all is null.
 * @param {string[]} days
 * @param {{ text: string, day: string }[]} entries
 * @param {string} pattern
 */
export function countSeries(days, entries, pattern) {
	const needle = pattern.toLowerCase()
	const counts = new Map()
	for (const entry of entries) {
		const hit = parseLineTime(entry.text, entry.day).body.toLowerCase().includes(needle) ? 1 : 0
		add(counts, entry.day, hit)
	}
	return aligned(days, counts)
}

/**
 * One habit as 1 (kept) / 0 (broken) / null (nothing decided or proposed),
 * using the same "manual wins" rule as the habits screen.
 * @param {string[]} days
 * @param {{ habit_id: string, day: string, by: string, value: string, created_at: number, deleted_at?: number|null }[]} ticks
 * @param {string} habitId
 */
export function habitSeries(days, ticks, habitId) {
	const byDay = new Map()
	for (const tick of ticks) {
		if (tick.habit_id !== habitId) continue
		if (!byDay.has(tick.day)) byDay.set(tick.day, [])
		byDay.get(tick.day).push(tick)
	}
	const values = new Map()
	for (const [day, dayTicks] of byDay) {
		const winner = effectiveTick(dayTicks)
		if (winner) values.set(day, winner.value === "kept" ? 1 : 0)
	}
	return aligned(days, values)
}

/**
 * Minutes asleep per day. A night belongs to the morning it ends — the local
 * date of `end_ts` — so "how did I sleep" lines up with the day that follows.
 * Naps on the same day add to it.
 * @param {string[]} days
 * @param {{ end_ts: number, asleep_min: number|null }[]} sessions  sleep_sessions rows
 */
export function sleepSeries(days, sessions) {
	const totals = new Map()
	for (const session of sessions) {
		if (session.asleep_min !== null) add(totals, localDay(session.end_ts), session.asleep_min)
	}
	return aligned(days, totals)
}

/**
 * One column of a per-day table (daily_vitals, daily_activity), aligned.
 * @param {string[]} days
 * @param {Record<string, unknown>[]} rows  rows with a `day` column
 * @param {string} column  e.g. "avg_hrv", "steps"
 */
export function dailySeries(days, rows, column) {
	const values = new Map()
	for (const row of rows) {
		if (row[column] !== null && row[column] !== undefined) values.set(row.day, row[column])
	}
	return aligned(days, values)
}

/**
 * Seconds per day from time_rollups for one source, optionally one key
 * (a site for `ext:firefox`, a package for `android:usagestats`).
 * @param {string[]} days
 * @param {{ day: string, source: string, key: string, seconds: number }[]} rollups
 * @param {{ source: string, key?: string }} filter
 */
export function screenTimeSeries(days, rollups, { source, key }) {
	const totals = new Map()
	for (const row of rollups) {
		if (row.source !== source) continue
		if (key !== undefined && row.key !== key) continue
		add(totals, row.day, row.seconds)
	}
	return aligned(days, totals)
}

// Firefox's package ids on Android, so its UsageStats row can be found.
const FIREFOX_PACKAGES = new Set(["org.mozilla.firefox", "org.mozilla.fenix", "org.mozilla.firefox_beta"])

/**
 * Time in the browser on one day — the double-count rule (V0.1 feature 7):
 * the extension's per-site rows are a BREAKDOWN of the browser's app time, not
 * siblings of it. When UsageStats reported Firefox, that figure is the total and
 * the per-site rows are never added to it; only without it do the sites sum.
 * @param {{ day: string, source: string, key: string, seconds: number }[]} rollups
 * @param {string} day
 * @returns {number|null}
 */
export function browserTotal(rollups, day) {
	const today = rollups.filter((row) => row.day === day)
	const app = today.find((row) => row.source === "android:usagestats" && FIREFOX_PACKAGES.has(row.key))
	if (app) return app.seconds
	const sites = today.filter((row) => row.source === "ext:firefox")
	if (sites.length === 0) return null
	return sites.reduce((sum, row) => sum + row.seconds, 0)
}

function add(map, day, amount) {
	map.set(day, (map.get(day) ?? 0) + amount)
}

/** `{ days, values }` with null wherever `byDay` has nothing for that day. */
function aligned(days, byDay) {
	return { days, values: days.map((day) => (byDay.has(day) ? byDay.get(day) : null)) }
}
