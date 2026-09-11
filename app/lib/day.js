import { localDay } from "@dotbook/core/parse"
import { addDays, format, parseISO } from "date-fns"

// Days are local calendar dates as "YYYY-MM-DD" strings — the `entries.day` column.
// Labels for people live in format.js.

export function today() {
	return localDay(Date.now())
}

export function shiftDay(day, delta) {
	return format(addDays(parseISO(day), delta), "yyyy-MM-dd")
}

export { dayLabel } from "./format"
