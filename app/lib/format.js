import { format, isToday, parseISO } from "date-fns"

// Every human-readable time and duration in the app, through date-fns, so a
// clock reads the same on every screen. Days are "YYYY-MM-DD" strings; instants
// are epoch ms.

/** `14:21` — 24-hour wall clock, no leading zero on the hour, the way lines are typed. */
export function clock(ts) {
	return format(ts, "H:mm")
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

/** `18:42`, or `1:03:07` once an hour or more is left. */
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
