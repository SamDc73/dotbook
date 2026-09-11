// Reading an exported timetable so nothing in it is retyped. Read only — this
// app never writes .ics.

import { TZDate } from "@date-fns/tz"
import ICAL from "ical.js"
import { renderLine } from "./occurrences.js"

const MINUTE_MS = 60 * 1000

/**
 * Every VEVENT in the file, split by whether it repeats.
 *
 * @param {string} icsText
 * @param {{ tzid: string }} options  zone for floating times (no TZID, no Z)
 * @returns {{
 *   recurrences: { text: string, rrule: string, dtstart: number, tzid: string,
 *                  duration_min: number|null, kind: "plan", source: "import:ics" }[],
 *   oneOffs: { day: string, text: string, ts_start: number, ts_end: number|null,
 *              kind: "plan", source: "import:ics" }[]
 * }}
 *   Recurrence rows come back without `id` / `created_at`; the caller adds those.
 */
export function recurrencesFromIcs(icsText, { tzid }) {
	const calendar = new ICAL.Component(ICAL.parse(icsText))
	const recurrences = []
	const oneOffs = []

	for (const component of calendar.getAllSubcomponents("vevent")) {
		const event = new ICAL.Event(component)
		const zone = zoneOf(component, tzid)
		const start = instant(event.startDate, zone)
		const durationMin = durationMinutes(event)
		const rrule = component.getFirstPropertyValue("rrule")

		if (rrule) {
			recurrences.push({
				text: event.summary,
				rrule: rrule.toString(),
				dtstart: start,
				tzid: zone,
				duration_min: durationMin,
				kind: "plan",
				source: "import:ics",
			})
			continue
		}

		const end = durationMin === null ? null : start + durationMin * MINUTE_MS
		oneOffs.push({
			day: dayOf(start, zone),
			text: renderLine(event.summary, start, end, zone),
			ts_start: start,
			ts_end: end,
			kind: "plan",
			source: "import:ics",
		})
	}
	return { recurrences, oneOffs }
}

/**
 * The zone a VEVENT's times are written in. ical.js only resolves a TZID when
 * the matching VTIMEZONE is registered, and otherwise reports "floating" — so the
 * parameter is read straight off the property instead. `Z` times are UTC.
 */
function zoneOf(component, fallbackTzid) {
	const dtstart = component.getFirstProperty("dtstart")
	const tzid = dtstart?.getParameter("tzid")
	if (tzid) {
		return tzid
	}
	if (dtstart?.getFirstValue()?.zone?.tzid === "UTC") {
		return "UTC"
	}
	return fallbackTzid
}

/** Epoch ms of an ICAL.Time's wall-clock reading in `zone`. All-day dates are midnight. */
function instant(time, zone) {
	return new TZDate(time.year, time.month - 1, time.day, time.hour, time.minute, zone).getTime()
}

/** Minutes between start and end, from DTEND or DURATION. All-day events have no clock span. */
function durationMinutes(event) {
	if (event.startDate.isDate) {
		return null
	}
	const seconds = event.duration.toSeconds()
	return seconds > 0 ? seconds / 60 : null
}

function dayOf(epochMs, zone) {
	const at = new TZDate(epochMs, zone)
	const month = String(at.getMonth() + 1).padStart(2, "0")
	const day = String(at.getDate()).padStart(2, "0")
	return `${at.getFullYear()}-${month}-${day}`
}
