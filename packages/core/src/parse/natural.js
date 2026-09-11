// Natural time prefixes: `now`, `ytd 9pm`, `30m ago`, `last night`, `tmr 8:00`.
//
// The fallback `parseLineTime` uses when the strict `H:MM` prefix does not match.
// chrono-node does the understanding; this file only decides what counts as a
// time and maps chrono's match back onto the text exactly as typed.

import * as chrono from "chrono-node"

// Shorthand chrono does not know, replaced before parsing. Only at line start,
// because the time is the bullet. chrono already understands `tmr` / `tmrw`.
// `last night` becomes 22:00 yesterday — the hour chrono itself gives `tonight`.
const ALIASES = [
	[/^ytd\b/i, "yesterday"],
	[/^last\s*night\b/i, "yesterday 10pm"],
]

/**
 * @param {string} text  the raw line
 * @param {string} day   local calendar date being logged, YYYY-MM-DD
 * @param {number} now   epoch ms, what `now` and `30m ago` are relative to
 * @returns {{ tsStart: number, timeText: string, day: string } | null}
 *   `timeText` is the phrase exactly as typed (aliases are not written back).
 */
export function parseNaturalTime(text, day, now) {
	const leading = text.length - text.trimStart().length
	const typed = text.slice(leading)
	const aliased = applyAlias(typed)

	// Nothing found, or found later in the line: not a prefix.
	const result = chrono.casual.parse(aliased.text, referenceOn(day, now))[0]
	if (result?.index !== 0) {
		return null
	}
	// A bare date (`today`, `yesterday`, `sat`) is not a time.
	if (!result.start.isCertain("hour")) {
		return null
	}

	const tsStart = result.start.date().getTime()
	const timeText = text.slice(0, leading + result.text.length - aliased.grew)
	return { tsStart, timeText, day: localDay(tsStart) }
}

/** Local calendar date of an instant, YYYY-MM-DD. */
export function localDay(epochMs) {
	const date = new Date(epochMs)
	const month = String(date.getMonth() + 1).padStart(2, "0")
	const day = String(date.getDate()).padStart(2, "0")
	return `${date.getFullYear()}-${month}-${day}`
}

/** Swap a leading alias for the words chrono knows; `grew` is how many characters longer the text got. */
function applyAlias(text) {
	for (const [pattern, replacement] of ALIASES) {
		const match = pattern.exec(text)
		if (match) {
			const replaced = replacement + text.slice(match[0].length)
			return { text: replaced, grew: replaced.length - text.length }
		}
	}
	return { text, grew: 0 }
}

/**
 * The instant chrono resolves phrases against: the clock time of `now`, on the
 * calendar date `day`. When `day` is today this is simply `now`. When a past day
 * is being backfilled, `5pm` lands on that day and `ytd 9pm` on the day before it.
 */
function referenceOn(day, now) {
	const [year, month, date] = day.split("-").map(Number)
	const clock = new Date(now)
	return new Date(year, month - 1, date, clock.getHours(), clock.getMinutes(), clock.getSeconds())
}
