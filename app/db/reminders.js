import { uuidv7 } from "uuidv7"
import { insertRow, updateRow } from "./sync"

// Reminders belong to a template (a daily time, `at`) or to one entry (a plan
// block's mark, fired at its ts_start). `escalation_min` is the T2 delay: the
// second nudge that answering T1 cancels for the day. Answers are the record of
// every tap, and the guard that makes handling a tap twice harmless.
// Writes go through insertRow/updateRow (db/sync.js), so a Yes on the phone
// cancels T2 on the laptop too.

// With the template name or the entry, whichever the reminder belongs to.
export function allReminders(db) {
	return db.sql`SELECT r.*, t.name AS template_name, e.text AS entry_text, e.day AS entry_day, e.ts_start AS entry_ts
		FROM reminders r
		LEFT JOIN templates t ON t.id = r.template_id
		LEFT JOIN entries e ON e.id = r.entry_id
		WHERE r.deleted_at IS NULL AND (e.id IS NULL OR e.deleted_at IS NULL)`
}

export function remindersFor(db, templateId) {
	return db.sql`SELECT * FROM reminders WHERE template_id = ${templateId} AND deleted_at IS NULL ORDER BY at`
}

/**
 * @param {object} db
 * @param {{ templateId?: string, entryId?: string, at?: string, escalationMin?: number|null, style?: "notify"|"alarm" }} fields
 *   Exactly one of `templateId` / `entryId`. `at` is HH:MM and only for templates.
 */
export async function addReminder(
	db,
	{ templateId = null, entryId = null, at = null, escalationMin = null, style = "notify" }
) {
	const id = uuidv7()
	await insertRow(db, "reminders", {
		id,
		template_id: templateId,
		entry_id: entryId,
		at,
		escalation_min: escalationMin,
		style,
		created_at: Date.now(),
		deleted_at: null,
	})
	return id
}

// Soft delete: the row stays so it can still sync and be audited.
export function removeReminder(db, id) {
	return updateRow(db, "reminders", { id }, { deleted_at: Date.now() })
}

// Undo for removeReminder; the caller reconciles, as after any reminder change.
export function restoreReminder(db, id) {
	return updateRow(db, "reminders", { id }, { deleted_at: null })
}

/**
 * Record a tap. `key` identifies the exact notification fire it answers; the
 * same fire answered twice (foreground listener and background task can both
 * see one tap) inserts once. Returns true only for the first insert, so the
 * caller writes the log line exactly once.
 * @param {"yes"|"not_yet"|"snooze"} answer
 */
export async function recordAnswer(db, { reminderId, day, answer, key }) {
	const seen = await db.sql`SELECT 1 FROM reminder_answers WHERE key = ${key}`.first()
	if (seen) {
		return false
	}
	try {
		await insertRow(db, "reminder_answers", {
			id: uuidv7(),
			reminder_id: reminderId,
			day,
			answer,
			answered_at: Date.now(),
			key,
		})
		return true
	} catch {
		// The other path claimed the same fire between the read and the write:
		// UNIQUE(key) refused the row and the whole batch rolled back.
		return false
	}
}

// Any answer at all on `day` — T2 is for the days nothing was tapped.
export async function answeredOn(db, reminderId, day) {
	const row =
		await db.sql`SELECT 1 FROM reminder_answers WHERE reminder_id = ${reminderId} AND day = ${day} LIMIT 1`.first()
	return row !== null
}

export function entryReminder(db, entryId) {
	return db.sql`SELECT * FROM reminders WHERE entry_id = ${entryId} AND deleted_at IS NULL`.first()
}

/**
 * The bell on a plan line: add a reminder at the block's mark, or remove the one
 * it has. Returns true when the entry now has a reminder. Call `reconcile(db)`
 * from notifications/reminders.js afterwards so the alarm is (un)scheduled.
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
