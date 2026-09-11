// Days are local calendar dates as "YYYY-MM-DD" strings — the `entries.day` column.

export function toDay(date) {
	const y = date.getFullYear()
	const m = String(date.getMonth() + 1).padStart(2, "0")
	const d = String(date.getDate()).padStart(2, "0")
	return `${y}-${m}-${d}`
}

export function today() {
	return toDay(new Date())
}

// Noon avoids DST edges: adding a day at 00:00 can land on 23:00 the same day.
export function shiftDay(day, delta) {
	const date = new Date(`${day}T12:00`)
	date.setDate(date.getDate() + delta)
	return toDay(date)
}

export function dayLabel(day) {
	if (day === today()) return "Today"
	return new Date(`${day}T12:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })
}
