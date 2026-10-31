import { api } from "../lib/api"
import { noteChange } from "../lib/changes"

// Web twin of db/recurrences.js: a rule is a row on the server, its
// occurrences become ordinary lines there. The `db` parameter is accepted and
// ignored. Every mutating call ends with noteChange().

export async function recurrences(_db) {
	const data = await api("/api/v1/recurrences")
	return data.recurrences
}

// `parts` is the form's shape — see ruleFromParts in core. `durationMin` null = point event.
export async function addRecurrence(_db, fields) {
	const data = await api("/api/v1/recurrences", { method: "POST", body: bodyOf(fields) })
	noteChange()
	return data.recurrence
}

// The form's `parts` as the endpoint reads them; the server rules in its own zone.
function bodyOf({ text, parts, durationMin, kind }) {
	const time = `${parts.hour}:${String(parts.minute).padStart(2, "0")}`
	return {
		text,
		freq: parts.freq,
		interval: parts.interval,
		byDay: parts.byDay,
		time,
		startDay: parts.dtstart,
		durationMin,
		kind,
	}
}

// Soft delete: occurrences already written stay in the log — they happened, or were planned.
export async function removeRecurrence(_db, id) {
	await api(`/api/v1/recurrences/${id}`, { method: "DELETE" })
	noteChange()
}

// Undo for removeRecurrence.
export async function restoreRecurrence(_db, id) {
	await api(`/api/v1/recurrences/${id}/restore`, { method: "POST" })
	noteChange()
}

// Editing retires the old rule and starts a new one. Days already materialised
// keep their lines, so a change to the series never rewrites the past.
export async function replaceRecurrence(_db, id, fields) {
	await api(`/api/v1/recurrences/${id}`, { method: "PUT", body: bodyOf(fields) })
	noteChange()
}

// A timetable export, so nothing in it is retyped. CONTRACT NOTE: the screen
// reads `counts.rules` and `counts.oneOffs`; the contract's `{ added }` must
// carry both, and this accepts either shape.
export async function importIcs(_db, text, tzid) {
	const data = await api("/api/v1/recurrences/ics", { method: "POST", body: { text, tzid } })
	const added = data.added ?? data
	noteChange()
	return { rules: added.rules ?? 0, oneOffs: added.oneOffs ?? 0 }
}

// Auto-materialise: the server writes each day's occurrences before the log is
// read, so opening a day here has nothing to do first.
export function materializeDay(_db, _day) {
	return Promise.resolve()
}
