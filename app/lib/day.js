import { localDay } from "@dotbook/core/parse"

// Days are local calendar dates as "YYYY-MM-DD" strings — the `entries.day` column.

export function today() {
	return localDay(Date.now())
}

// Noon avoids DST edges: adding a day at 00:00 can land on 23:00 the same day.
export function shiftDay(day, delta) {
	const date = new Date(`${day}T12:00`)
	date.setDate(date.getDate() + delta)
	return localDay(date.getTime())
}

export function dayLabel(day) {
	if (day === today()) return "Today"
	return new Date(`${day}T12:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })
}
