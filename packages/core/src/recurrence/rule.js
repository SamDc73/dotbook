// Between the RRULE text we store and the RRule object that expands it.
//
// Two libraries, one job each: ical.js reads and writes RFC 5545 `RRULE` strings
// (rrule-es cannot), rrule-es expands them with real timezone rules (ical.js's
// own expansion needs VTIMEZONE data we do not ship). The time of day is never
// in the string — it comes from `dtstart`, exactly as the RFC says.

import { TZDate } from "@date-fns/tz"
import ICAL from "ical.js"
import RRule, { Frequency, Weekday } from "rrule-es"

// `-1MO` → the last Monday; `TU` → every Tuesday.
const BY_DAY = /^([+-]?\d+)?(MO|TU|WE|TH|FR|SA|SU)$/

/**
 * The rrule-es rule for one `recurrences` row.
 * @param {{ rrule: string, dtstart: number, tzid: string }} recurrence
 */
export function toRRule(recurrence) {
	const recur = ICAL.Recur.fromString(recurrence.rrule)
	const parts = recur.parts
	return new RRule({
		tzid: recurrence.tzid,
		dtStart: new Date(recurrence.dtstart),
		freq: Frequency[recur.freq],
		interval: recur.interval,
		count: recur.count ?? undefined,
		until: untilDate(recur.until, recurrence.tzid),
		wkst: parts.WKST ? Weekday[parts.WKST[0]] : undefined,
		byDay: parts.BYDAY?.map(weekday),
		byMonth: parts.BYMONTH,
		byMonthDay: parts.BYMONTHDAY,
		byHour: parts.BYHOUR,
		byMinute: parts.BYMINUTE,
		bySetPos: parts.BYSETPOS,
	})
}

/** `"TU"` → Weekday.TU, `"-1MO"` → [-1, Weekday.MO]. */
function weekday(text) {
	const [, nth, day] = BY_DAY.exec(text)
	return nth ? [Number(nth), Weekday[day]] : Weekday[day]
}

/**
 * UNTIL as a JS Date. The RFC makes UNTIL inclusive — exports routinely set it to
 * the last occurrence's exact time — but rrule-es 1.0.0 treats it as exclusive,
 * so one millisecond is added. A date-only UNTIL means "through the end of that day".
 */
function untilDate(until, tzid) {
	if (!until) {
		return undefined
	}
	if (until.isDate) {
		return new TZDate(until.year, until.month - 1, until.day + 1, tzid)
	}
	return new Date(until.toUnixTime() * 1000 + 1)
}

/**
 * The app's "class every Tue/Thu 14:00" form → what the row stores.
 *
 * @param {{ freq: "daily"|"weekly"|"monthly", interval?: number, byDay?: string[],
 *           hour: number, minute: number, dtstart: string, tzid: string }} parts
 *   `byDay` uses the RFC two-letter codes (`["TU","TH"]`); `dtstart` is the
 *   YYYY-MM-DD the series starts on.
 * @returns {{ rrule: string, dtstart: number }}
 */
export function ruleFromParts(parts) {
	const recur = new ICAL.Recur({ freq: parts.freq.toUpperCase(), interval: parts.interval ?? 1 })
	if (parts.byDay?.length) {
		recur.setComponent("BYDAY", parts.byDay)
	}
	const [year, month, day] = parts.dtstart.split("-").map(Number)
	const dtstart = new TZDate(year, month - 1, day, parts.hour, parts.minute, parts.tzid).getTime()
	return { rrule: recur.toString(), dtstart }
}

/**
 * The inverse of `ruleFromParts`, for the edit form. Takes the row (not just the
 * string) because the hour, minute, and start day live in `dtstart`.
 * @param {{ rrule: string, dtstart: number, tzid: string }} recurrence
 */
export function partsFromRule(recurrence) {
	const recur = ICAL.Recur.fromString(recurrence.rrule)
	const start = new TZDate(recurrence.dtstart, recurrence.tzid)
	const month = String(start.getMonth() + 1).padStart(2, "0")
	const day = String(start.getDate()).padStart(2, "0")
	return {
		freq: recur.freq.toLowerCase(),
		interval: recur.interval,
		byDay: recur.parts.BYDAY ?? [],
		hour: start.getHours(),
		minute: start.getMinutes(),
		dtstart: `${start.getFullYear()}-${month}-${day}`,
		tzid: recurrence.tzid,
	}
}
