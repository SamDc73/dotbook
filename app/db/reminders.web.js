import { api } from "../lib/api"
import { noteChange } from "../lib/changes"

// Web twin of db/reminders.js: reminders belong to a template (a daily time,
// `at`) or to one entry (a plan block's mark). The `db` parameter is accepted
// and ignored. Every mutating call ends with noteChange().
//
// CONTRACT GAPS (flagged, nothing invented): there is no per-template
// reminder read, so `remindersFor` filters the full list; template reminders
// ride the create endpoint's extra fields; the answers/answered response
// shapes are read defensively.

// With the template name or the entry, whichever the reminder belongs to, and
// the todo when the entry is a todo's plan line.
export async function allReminders(_db) {
	const data = await api("/api/v1/reminders")
	return data.reminders
}

// A template's reminders, by `at`. Filtered from the full list — the rows
// carry `template_id` the same way the native query's rows do.
export async function remindersFor(db, templateId) {
	const reminders = await allReminders(db)
	return reminders.filter((reminder) => reminder.template_id === templateId)
}

/**
 * Exactly one of `templateId` / `entryId`. `at` is HH:MM and only for
 * templates. CONTRACT NOTE: the contract names `{ entryId + create fields }`;
 * a template reminder sends its own fields and counts on the server accepting
 * them, as the native sibling's row shape says it must.
 */
export async function addReminder(
	_db,
	{ templateId = null, entryId = null, at = null, escalationMin = null, style = "notify" }
) {
	const data = await api("/api/v1/reminders", {
		method: "POST",
		body: { templateId, entryId, at, escalationMin, style },
	})
	noteChange()
	return data.reminder?.id ?? null
}

// Soft delete: the row stays so it can still be audited — the server keeps it.
export async function removeReminder(_db, id) {
	await api(`/api/v1/reminders/${id}`, { method: "DELETE" })
	noteChange()
}

// Undo for removeReminder.
export async function restoreReminder(_db, id) {
	await api(`/api/v1/reminders/${id}/restore`, { method: "POST" })
	noteChange()
}

/**
 * Record a tap. `key` identifies the exact notification fire it answers; the
 * same fire answered twice inserts once, and this returns true only for the
 * first insert, so the caller writes the log line exactly once. CONTRACT
 * NOTE: `day` and `key` travel with the answer; the server deduplicates on
 * `key` and says so with `first`.
 * @param {"yes"|"not_yet"|"snooze"} answer
 */
export async function recordAnswer(_db, { reminderId, day, answer, key }) {
	const data = await api("/api/v1/reminders/answers", {
		method: "POST",
		body: { reminderId, day, answer, key },
	})
	noteChange()
	return data?.first ?? true
}

// Any answer at all on `day` — T2 is for the days nothing was tapped.
// CONTRACT NOTE: the payload shape is not pinned down; a list of reminder ids
// or of answer rows are both read.
export async function answeredOn(_db, reminderId, day) {
	const data = await api(`/api/v1/reminders/answered?day=${encodeURIComponent(day)}`)
	const answers = data.answers ?? data.answered ?? []
	return answers.some((row) => (typeof row === "string" ? row : (row.reminder_id ?? row.reminderId)) === reminderId)
}

// The reminder on one entry, or null.
export async function entryReminder(_db, entryId) {
	const data = await api(`/api/v1/reminders/entry/${entryId}`)
	return data.reminder ?? data.reminders?.[0] ?? null
}

/**
 * The bell on a plan line: add a reminder at the block's mark, or remove the
 * one it has. Returns true when the entry now has a reminder.
 * @param {{ id: string }} entry
 * @param {"notify"|"alarm"} style
 */
export async function toggleEntryReminder(db, entry, style = "notify") {
	const existing = await entryReminder(db, entry.id)
	if (existing) {
		await removeReminder(db, existing.id)
		return false
	}
	await addReminder(db, { entryId: entry.id, style })
	return true
}
