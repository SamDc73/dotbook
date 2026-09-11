// Which occurrences of a rule fall on a given day, and the lines they become.

import { TZDate } from "@date-fns/tz"
import { toRRule } from "./rule.js"

const MINUTE_MS = 60 * 1000

/**
 * Epoch-ms starts of `recurrence` on local calendar `day`, in the rule's zone.
 * The day window is built by the timezone library, so a DST change inside the
 * day (23 or 25 hours long) is handled without any offset arithmetic here.
 *
 * @param {{ rrule: string, dtstart: number, tzid: string, deleted_at?: number|null }} recurrence
 * @param {string} day  YYYY-MM-DD
 * @returns {number[]}
 */
export function occurrencesOn(recurrence, day) {
	if (recurrence.deleted_at) {
		return []
	}
	const [year, month, date] = day.split("-").map(Number)
	const dayStart = new TZDate(year, month - 1, date, recurrence.tzid)
	const dayEnd = new TZDate(year, month - 1, date + 1, recurrence.tzid)

	// [00:00, 24:00): the start is inclusive, the end belongs to tomorrow.
	return toRRule(recurrence)
		.between(dayStart, dayEnd, { inclusive: true })
		.filter((occurrence) => occurrence < dayEnd)
		.map((occurrence) => occurrence.getTime())
}

/**
 * The `entries` rows to create for `day` — one per occurrence, written in the
 * same syntax a person types so the line log treats them like any other line.
 *
 * @param {{ text: string, rrule: string, dtstart: number, tzid: string,
 *           duration_min?: number|null, kind: string, deleted_at?: number|null }} recurrence
 * @param {string} day  YYYY-MM-DD
 * @returns {{ day: string, text: string, ts_start: number, ts_end: number|null, kind: string, source: "recurrence" }[]}
 */
export function occurrenceLines(recurrence, day) {
	return occurrencesOn(recurrence, day).map((tsStart) => {
		const tsEnd = recurrence.duration_min ? tsStart + recurrence.duration_min * MINUTE_MS : null
		return {
			day,
			text: renderLine(recurrence.text, tsStart, tsEnd, recurrence.tzid),
			ts_start: tsStart,
			ts_end: tsEnd,
			kind: recurrence.kind,
			source: "recurrence",
		}
	})
}

/** `14:00 class`, or `14:00 -> 15:30 class` — the prefix `parse/time.js` reads back. */
export function renderLine(text, tsStart, tsEnd, tzid) {
	if (tsEnd === null) {
		return `${clock(tsStart, tzid)} ${text}`
	}
	return `${clock(tsStart, tzid)} -> ${clock(tsEnd, tzid)} ${text}`
}

/** Wall-clock `H:MM` in `tzid`, 24-hour, no leading zero on the hour. */
function clock(epochMs, tzid) {
	const at = new TZDate(epochMs, tzid)
	return `${at.getHours()}:${String(at.getMinutes()).padStart(2, "0")}`
}
