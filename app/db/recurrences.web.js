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
export async function addRecurrence(_db, { text, parts, durationMin, kind }) {
	const data = await api("/api/v1/recurrences", {
		method: "POST",
		body: { text, parts, durationMin, kind },
	})
	noteChange()
	return data.recurrence
}

// Soft delete: occurrences already written stay in the log — they happened, or were planned.
export async function removeRecurrence(_db, id) {
	await api(`/api/v1/recurrences/${id}`, { method: "DELETE" })
	noteChange()
}

// CONTRACT GAP: the endpoint list has no restore for a removed recurrence, so
// the undo the screen offers after a removal cannot be honoured on web. This
// rejects loudly rather than pretending the rule came back.
export function restoreRecurrence(_db, _id) {
	return Promise.reject(new Error("restoreRecurrence: the server contract has no restore endpoint for recurrences"))
}

// Editing retires the old rule and starts a new one. Days already materialised
// keep their lines, so a change to the series never rewrites the past.
export async function replaceRecurrence(_db, id, fields) {
	await api(`/api/v1/recurrences/${id}`, {
		method: "PUT",
		body: { text: fields.text, parts: fields.parts, durationMin: fields.durationMin, kind: fields.kind },
	})
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
