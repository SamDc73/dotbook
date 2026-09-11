import { format, isToday, parseISO } from "date-fns"

// Every human-readable time and duration in the app, through date-fns, so a
// clock reads the same on every screen. Days are "YYYY-MM-DD" strings; instants
// are epoch ms. Clocks are 12-hour — `7:36 am`, `1:05 pm` — and that is also
// what the app writes into a line's text (the stamp, `done:` lines, recurring
// lines), so what you read is what you would have typed. Storage is untouched:
// `ts_start`/`ts_end` are epoch ms, and the parser accepts both forms.

/** `7:36 am`, `1:05 pm` — no leading zero, lowercase, a normal space. */
export function clock(ts) {
	return format(ts, "h:mm aaa")
}

/** A clock for a wall time given as hour and minute (a reminder's `09:00`, a rule's parts). */
export function clockAt(hour, minute) {
	return clock(new Date(2000, 0, 1, hour, minute))
}

/**
 * The two ends of a range as the pill draws them: the meridiem once when both
 * share it — `8:30` and `10:00 am` — and on each when they differ — `11:30 am`
 * and `1:00 pm`.
 */
export function rangeParts(tsStart, tsEnd) {
	const shared = format(tsStart, "aaa") === format(tsEnd, "aaa")
	return { start: shared ? format(tsStart, "h:mm") : clock(tsStart), end: clock(tsEnd) }
}

/** `8:30 → 10:00 am`, `11:30 am → 1:00 pm` */
export function range(tsStart, tsEnd) {
	const { start, end } = rangeParts(tsStart, tsEnd)
	return `${start} → ${end}`
}

/** `Tue 9 Sep` */
export function dateLabel(ts) {
	return format(ts, "EEE d MMM")
}

/** `Today`, else `Tue 9 Sep`. */
export function dayLabel(day) {
	const date = parseISO(day)
	return isToday(date) ? "Today" : format(date, "EEE d MMM")
}

/** `Thu` */
export function weekday(day) {
	return format(parseISO(day), "EEE")
}

/** `1h 12m`, `45m` */
export function minutesLabel(ms) {
	const minutes = Math.round(ms / 60000)
	const hours = Math.floor(minutes / 60)
	if (hours === 0) return `${minutes}m`
	return `${hours}h ${minutes % 60}m`
}

/** `18:42`, or `1:03:07` once an hour or more is left. A duration, not a clock. */
export function countdown(ms) {
	const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
	const hours = Math.floor(totalSeconds / 3600)
	const minutes = Math.floor((totalSeconds % 3600) / 60)
	const seconds = totalSeconds % 60
	if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`
	return `${pad(minutes)}:${pad(seconds)}`
}

function pad(n) {
	return String(n).padStart(2, "0")
}
