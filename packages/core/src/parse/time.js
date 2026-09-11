// The time prefix of a log line: `7:36 woke up`, `8:30 -> 10:00 daydreaming`.
//
// The strict forms are handled here. When they do not match, natural phrases
// (`ytd 9pm`, `30m ago`, `now`) are tried by natural.js — see the bottom.
//
// This function annotates. It never rewrites the line; `text` stays raw in storage.

import { parseNaturalTime } from "./natural.js"

// One time: `7:36`, `07:36`, `3:30 PM`, `4:00 p.m.`
//   hour      1–2 digits
//   minute    exactly 2 digits
//   meridiem  optional am / pm / a.m. / p.m., any case, optional space before it
const TIME = String.raw`(\d{1,2}):(\d{2})(?:\s?([ap])\.?m\.?)?`

// Between the two times of a range: `->`, `→`, `-`, `–`, `—`, spaces optional.
const SEPARATOR = String.raw`\s*(?:->|→|-|–|—)\s*`

// The whole prefix, anchored at the start (leading whitespace allowed).
// Groups: 1 startHour, 2 startMinute, 3 startMeridiem, 4 endHour, 5 endMinute, 6 endMeridiem.
// A time must be followed by end of line or whitespace, so `7:36abc` is not a time.
const LINE_PREFIX = new RegExp(String.raw`^\s*${TIME}(?:${SEPARATOR}${TIME})?(?=\s|$)`, "i")

const NO_TIME = Object.freeze({ tsStart: null, tsEnd: null, timeText: "" })

/**
 * Parse the time prefix of a line.
 *
 * @param {string} text  the raw line, exactly as typed
 * @param {string} day   local calendar date the line belongs to, YYYY-MM-DD
 * @param {number} [now] epoch ms that `now` / `30m ago` are relative to; defaults to the clock
 * @returns {{ tsStart: number|null, tsEnd: number|null, timeText: string, body: string, day: string }}
 *   `timeText` is the matched prefix as typed; `body` is everything after it, trimmed.
 *   `day` is the local date of `tsStart` — the `day` given, unless a natural phrase
 *   like `ytd 9pm` moved it. No valid time → tsStart/tsEnd null, timeText "", body
 *   is the whole trimmed line.
 */
export function parseLineTime(text, day, now = Date.now()) {
	const match = LINE_PREFIX.exec(text)
	if (!match) {
		return naturalOrNoTime(text, day, now)
	}

	const [timeText, startHour, startMinute, startMeridiem, endHour, endMinute, endMeridiem] = match

	// `3:30 -> 4:00 PM`: a meridiem written only on the end applies to the start too,
	// as long as the start could be a 12-hour time.
	const sharedMeridiem = !startMeridiem && endMeridiem && Number(startHour) <= 12 ? endMeridiem : startMeridiem

	const start = toMinutesOfDay(startHour, startMinute, sharedMeridiem)
	if (start === null) {
		return { ...NO_TIME, body: text.trim(), day }
	}

	let end = null
	if (endHour !== undefined) {
		end = toMinutesOfDay(endHour, endMinute, endMeridiem)
		if (end === null) {
			return { ...NO_TIME, body: text.trim(), day }
		}
		// `23:00 -> 1:00` ends tomorrow.
		if (end < start) {
			end += 24 * 60
		}
	}

	return {
		tsStart: epochMs(day, start),
		tsEnd: end === null ? null : epochMs(day, end),
		timeText,
		body: text.slice(timeText.length).trim(),
		day,
	}
}

/** The natural-phrase fallback, or the no-time result. */
function naturalOrNoTime(text, day, now) {
	const natural = parseNaturalTime(text, day, now)
	if (!natural) {
		return { ...NO_TIME, body: text.trim(), day }
	}
	return {
		tsStart: natural.tsStart,
		tsEnd: null,
		timeText: natural.timeText,
		body: text.slice(natural.timeText.length).trim(),
		day: natural.day,
	}
}

/**
 * Minutes since local midnight, or null when the digits are not a real time.
 * @param {string} hourText
 * @param {string} minuteText
 * @param {string|undefined} meridiem  "a" or "p" (already lower/upper-case insensitive), or undefined for 24h
 */
function toMinutesOfDay(hourText, minuteText, meridiem) {
	let hour = Number(hourText)
	const minute = Number(minuteText)
	if (minute > 59) {
		return null
	}

	if (meridiem) {
		// 12-hour clock: 1–12 only; 12 am is midnight, 12 pm is noon.
		if (hour < 1 || hour > 12) {
			return null
		}
		if (hour === 12) {
			hour = 0
		}
		if (meridiem.toLowerCase() === "p") {
			hour += 12
		}
	} else if (hour > 23) {
		return null
	}

	return hour * 60 + minute
}

/**
 * UTC epoch ms for `minutes` after local midnight on `day`.
 * Built with the Date constructor so it follows the runtime's local zone;
 * `Date` normalises minutes past 24h into the next day.
 * @param {string} day  YYYY-MM-DD
 * @param {number} minutes
 */
function epochMs(day, minutes) {
	const [year, month, date] = day.split("-").map(Number)
	return new Date(year, month - 1, date, 0, minutes).getTime()
}
