import {
	browserTotal,
	correlations,
	dailySeries,
	habitSeries,
	lagScan,
	movingAverage,
	quantitySeries,
	screenTimeSeries,
	sleepSeries,
	withVsWithout,
} from "@dotbook/core/analysis"
import { shiftDay } from "../lib/day"

// What the trends screen reads for one window of days, and the series built
// from it. Read-only. Every number comes from @dotbook/core/analysis, so the
// phone and the web app draw the same figures from the same rows.

const HABIT_WINDOW = 7
const TOP_QUANTITIES = 5
const MAX_CORRELATIONS = 10
const MAX_COMPARISONS = 5

// Vitals columns worth a line, and the name each goes by on screen.
const VITALS = [
	["avg_hrv", "HRV", "number"],
	["avg_hr", "heart rate", "number"],
	["avg_spo2", "SpO2", "percentValue"],
]

// The measures a habit is compared against in "with vs without".
const COMPARED = new Set(["sleep", "HRV", "steps", "screen time"])

/** The axis: every day from `fromDay` to `toDay`, ascending. */
export function days(fromDay, toDay) {
	const axis = []
	for (let day = fromDay; day <= toDay; day = shiftDay(day, 1)) {
		axis.push(day)
	}
	return axis
}

/** Every row the series need, in one round of reads. */
export async function windowRows(db, fromDay, toDay) {
	const fromMs = midnight(fromDay)
	const toMs = midnight(shiftDay(toDay, 1))
	const [entries, items, habits, ticks, sleep, vitals, activity, rollups] = await Promise.all([
		db.sql`SELECT id, day, text FROM entries
			WHERE kind = 'log' AND deleted_at IS NULL AND day BETWEEN ${fromDay} AND ${toDay}`,
		db.sql`SELECT i.entry_id, i.name, i.qty, i.unit, e.day FROM entry_items i
			JOIN entries e ON e.id = i.entry_id
			WHERE e.kind = 'log' AND e.deleted_at IS NULL AND e.day BETWEEN ${fromDay} AND ${toDay}`,
		db.sql`SELECT id, name, kind FROM habits WHERE deleted_at IS NULL ORDER BY created_at`,
		db.sql`SELECT habit_id, day, value, by, created_at FROM habit_ticks
			WHERE deleted_at IS NULL AND day BETWEEN ${fromDay} AND ${toDay}`,
		db.sql`SELECT end_ts, asleep_min FROM sleep_sessions WHERE end_ts >= ${fromMs} AND end_ts < ${toMs}`,
		db.sql`SELECT * FROM daily_vitals WHERE day BETWEEN ${fromDay} AND ${toDay}`,
		db.sql`SELECT * FROM daily_activity WHERE day BETWEEN ${fromDay} AND ${toDay}`,
		db.sql`SELECT day, source, key, seconds FROM time_rollups WHERE day BETWEEN ${fromDay} AND ${toDay}`,
	])
	return { entries, items, habits, ticks, sleep, vitals, activity, rollups }
}

/**
 * Every series with at least one value in the window, as
 * `{ name, label, raw, bars, format, flag }`: `raw` feeds the statistics,
 * `bars` is what the sparkline draws (a habit's 7-day average), `flag` marks a
 * 0/1 series usable as a with-vs-without switch.
 */
export function seriesFor(rows, axis) {
	const {
		entries = [],
		items = [],
		habits = [],
		ticks = [],
		sleep = [],
		vitals = [],
		activity = [],
		rollups = [],
	} = rows
	const series = []

	for (const habit of habits) {
		const raw = habitSeries(axis, ticks, habit.id).values
		const bars = movingAverage(raw, HABIT_WINDOW)
		const last = lastValue(bars)
		const label =
			last === null ? habit.name : `${habit.name} · kept ${format("fraction", last)} of the last ${HABIT_WINDOW}`
		series.push({ name: habit.name, label, raw, bars, format: "fraction", flag: true })
	}
	series.push({ name: "sleep", raw: sleepSeries(axis, sleep).values, format: "minutes" })
	for (const [column, name, kind] of VITALS) {
		series.push({ name, raw: dailySeries(axis, vitals, column).values, format: kind })
	}
	series.push({ name: "steps", raw: dailySeries(axis, activity, "steps").values, format: "number" })
	series.push({ name: "screen time", raw: screenTotal(axis, rollups), format: "seconds" })
	for (const { name, unit } of topQuantities(items)) {
		const label = unit === null ? name : `${name} (${unit})`
		series.push({ name, label, raw: quantitySeries(axis, items, entries, name).values, format: "number" })
	}

	return series
		.filter((one) => one.raw.some((value) => value !== null))
		.map((one) => ({ label: one.name, bars: one.raw, flag: false, days: axis, ...one }))
}

/** The strongest pairs with a usable r, and the lag at which each is strongest. */
export function correlationRows(series) {
	const byName = Object.fromEntries(series.map((one) => [one.name, one.raw]))
	return correlations(byName)
		.filter((pair) => pair.r !== null)
		.slice(0, MAX_CORRELATIONS)
		.map((pair) => ({ ...pair, best: lagScan(byName[pair.a], byName[pair.b]) }))
}

/** Each habit against each measure, largest change first. */
export function comparisonRows(series) {
	const rows = []
	for (const flag of series.filter((one) => one.flag)) {
		for (const measure of series.filter((one) => COMPARED.has(one.name))) {
			const result = withVsWithout(flag.raw, measure.raw)
			if (result) {
				rows.push({ habit: flag.name, measure: measure.name, ...result })
			}
		}
	}
	return rows.sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, MAX_COMPARISONS)
}

/** A value in the unit its series is stored in, as a person reads it. */
export function format(kind, value) {
	if (value === null) {
		return "–"
	}
	if (kind === "minutes") {
		return duration(value)
	}
	if (kind === "seconds") {
		return duration(value / 60)
	}
	if (kind === "fraction") {
		return `${Math.round(value * 100)}%`
	}
	if (kind === "percentValue") {
		return `${rounded(value)}%`
	}
	return String(rounded(value))
}

// Total screen time per day. Firefox's per-site rows (`ext:firefox`) are a
// BREAKDOWN of the browser's app time, never siblings of it: the apps are
// summed without Firefox's package, then `browserTotal` adds the browser once —
// its UsageStats figure when there is one, the sites' sum only when there is not.
function screenTotal(axis, rollups) {
	const withoutFirefox = rollups.filter((row) => !row.key.startsWith("org.mozilla."))
	const apps = screenTimeSeries(axis, withoutFirefox, { source: "android:usagestats" }).values
	return axis.map((day, i) => {
		const browser = browserTotal(rollups, day)
		if (apps[i] === null && browser === null) {
			return null
		}
		return (apps[i] ?? 0) + (browser ?? 0)
	})
}

// The items logged on the most days, with the unit they are usually logged in.
function topQuantities(items) {
	const byName = new Map()
	for (const item of items) {
		if (item.qty === null) continue
		if (!byName.has(item.name)) byName.set(item.name, { days: new Set(), units: new Map() })
		const stat = byName.get(item.name)
		stat.days.add(item.day)
		stat.units.set(item.unit, (stat.units.get(item.unit) ?? 0) + 1)
	}
	return [...byName]
		.sort((a, b) => b[1].days.size - a[1].days.size)
		.slice(0, TOP_QUANTITIES)
		.map(([name, stat]) => ({ name, unit: commonest(stat.units) }))
}

function commonest(counts) {
	let best = null
	for (const [unit, count] of counts) {
		if (best === null || count > counts.get(best)) best = unit
	}
	return best
}

function lastValue(values) {
	for (let i = values.length - 1; i >= 0; i--) {
		if (values[i] !== null) return values[i]
	}
	return null
}

function duration(minutes) {
	const whole = Math.round(minutes)
	const hours = Math.floor(whole / 60)
	if (hours === 0) return `${whole}m`
	return `${hours}h ${whole % 60}m`
}

function rounded(value) {
	return Number.isInteger(value) ? value : Number(value.toFixed(1))
}

function midnight(day) {
	return new Date(`${day}T00:00`).getTime()
}
