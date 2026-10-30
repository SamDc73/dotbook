// The server's half of app/db/reminders.js — same shapes the screens read,
// writes through publish/publishUpdate so they sync.

import { uuidv7 } from "uuidv7"
import { publish, publishUpdate } from "../sync/publish.js"

/** All reminders with joined template and entry info. */
export function allReminders(db) {
	return db.all(`SELECT r.*, t.name AS template_name, e.text AS entry_text, e.day AS entry_day, e.ts_start AS entry_ts,
		td.id AS todo_id, td.text AS todo_text
	FROM reminders r
	LEFT JOIN templates t ON t.id = r.template_id
	LEFT JOIN entries e ON e.id = r.entry_id
	LEFT JOIN todo_links l ON l.entry_id = e.id AND l.origin = 'planned'
	LEFT JOIN todos td ON td.id = l.todo_id AND td.deleted_at IS NULL
	WHERE r.deleted_at IS NULL AND (e.id IS NULL OR e.deleted_at IS NULL)
		AND (td.id IS NULL OR td.status = 'open')`)
}

export function remindersFor(db, templateId) {
	return db.all("SELECT * FROM reminders WHERE template_id = ? AND deleted_at IS NULL ORDER BY at", [templateId])
}

/** Add a reminder (template or entry). Returns the new reminder id. */
export function addReminder(
	db,
	groupId,
	{ templateId = null, entryId = null, at = null, escalationMin = null, style = "notify" }
) {
	const id = uuidv7()
	return publish(db, groupId, "reminders", [
		{
			id,
			template_id: templateId,
			entry_id: entryId,
			at,
			escalation_min: escalationMin,
			style,
			created_at: Date.now(),
			deleted_at: null,
		},
	]).then(() => id)
}

/** Soft-delete a reminder. */
export function removeReminder(db, groupId, id) {
	return publishUpdate(db, groupId, "reminders", { id }, { deleted_at: Date.now() })
}

/** Undo delete. */
export function restoreReminder(db, groupId, id) {
	return publishUpdate(db, groupId, "reminders", { id }, { deleted_at: null })
}

/** Record a tap on a reminder instance. Returns true only for the first insert. */
export async function recordAnswer(db, groupId, { reminderId, day, answer, key }) {
	const seen = await db.get("SELECT 1 FROM reminder_answers WHERE key = ?", [key])
	if (seen) return false
	try {
		await publish(db, groupId, "reminder_answers", [
			{
				id: uuidv7(),
				reminder_id: reminderId,
				day,
				answer,
				answered_at: Date.now(),
				key,
			},
		])
		return true
	} catch {
		// Unique violation or race — treat as not newly inserted.
		return false
	}
}

/** Every answer recorded on a day — the web client compares ids itself. */
export function answersOn(db, day) {
	return db.all("SELECT reminder_id, day, answer FROM reminder_answers WHERE day = ?", [day])
}

/** Whether any answer existed for a reminder on a given day. */
export async function answeredOn(db, reminderId, day) {
	const row = await db.get("SELECT 1 FROM reminder_answers WHERE reminder_id = ? AND day = ? LIMIT 1", [
		reminderId,
		day,
	])
	return row !== undefined
}

/** Get the reminder linked to an entry, if any. */
export function entryReminder(db, entryId) {
	return db.get("SELECT * FROM reminders WHERE entry_id = ? AND deleted_at IS NULL", [entryId])
}

/** Toggle a reminder on a plan entry. Returns true if a reminder now exists. */
export async function toggleEntryReminder(db, groupId, entry, style = "notify") {
	const existing = await entryReminder(db, entry.id)
	if (existing) {
		await removeReminder(db, groupId, existing.id)
		return false
	}
	await addReminder(db, groupId, { entryId: entry.id, style })
	return true
}
