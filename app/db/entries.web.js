import { localDay, parseLineTime } from "@dotbook/core/parse"
import { api } from "../lib/api"
import { noteChange } from "../lib/changes"
import { clock } from "../lib/format"

// Web twin of db/entries.js: same names, same signatures, the same shapes the
// screens consume. The `db` the native sibling opens is accepted and ignored —
// the server holds the rows. Every mutating call ends with noteChange().

// A day's lines with their template use, if any. The server returns them in
// typing order (seq, id); `order: "chronological"` sorts by time here, the way
// the native sibling's query + sort does.
export async function entriesForDay(_db, day, order) {
	const { entries } = await api(`/api/v1/days/${encodeURIComponent(day)}/entries`)
	if (order === "chronological") {
		entries.sort(byTime)
	}
	return entries
}

// Timed lines by their time; untimed lines after them. A stable sort keeps typing order for ties.
function byTime(a, b) {
	if (a.ts_start === null || b.ts_start === null) {
		return (a.ts_start === null) - (b.ts_start === null)
	}
	return a.ts_start - b.ts_start
}

export async function addEntry(_db, { day, text, source = "manual", stampedAt = null, kind = null }) {
	const { entry } = await api("/api/v1/lines", {
		method: "POST",
		body: { day, text, kind: kind ?? undefined, source, stampedAt },
	})
	noteChange()
	return entry.id
}

export async function updateEntryText(_db, id, text, _day) {
	// The server re-derives day/times/kind from the text against the line's own
	// day — the same parse the native sibling runs, on the row's day.
	await api(`/api/v1/lines/${id}`, { method: "PATCH", body: { text } })
	noteChange()
}

// A line typed today without a time is stamped with the current one — the time
// is the bullet, so every line gets one. Written into the text itself, exactly
// as if typed, so the row stays a plain line; `stampedAt` remembers the app did
// it (kept, not shown). Other days and `/` commands are left alone.
export function stampedNow(text, day, now = Date.now()) {
	if (text.startsWith("/") || day !== localDay(now) || parseLineTime(text, day, now).timeText !== "") {
		return { text, stampedAt: null }
	}
	return { text: `${clock(now)} ${text}`, stampedAt: now }
}

// "Did it?" — a plan line becomes a log line when you confirm what happened.
export async function confirmPlan(_db, id) {
	await api(`/api/v1/lines/${id}/confirm`, { method: "POST" })
	noteChange()
}

// Only the items cache is device-local; the server rebuilds its own derived
// data when a line is written or edited, so there is nothing to reannotate here.
export function reannotate(_db, _entryIds) {
	return Promise.resolve()
}

// Soft delete: the row stays so it can still be audited — the server keeps it.
export async function deleteEntry(_db, id) {
	await api(`/api/v1/lines/${id}`, { method: "DELETE" })
	noteChange()
}

// Undo for deleteEntry: the same row, live again.
export async function restoreEntry(_db, id) {
	await api(`/api/v1/lines/${id}/restore`, { method: "POST" })
	noteChange()
}
