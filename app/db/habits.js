import { uuidv7 } from "uuidv7"
import { insertRow, updateRow } from "./sync"

// Habits and their ticks. A tick is a row per (habit, day) with `by` saying who
// wrote it: a person (`manual`) or the classifier (`llm`). Nothing here ranks
// them — `effectiveTick` in @dotbook/core/habits does, so phone and server agree.
// Writes go through insertRow/updateRow (db/sync.js). See V0.1 → feature 6.

export function habits(db) {
	return db.sql`SELECT * FROM habits WHERE deleted_at IS NULL ORDER BY created_at`
}

// `kind`: `do` (a thing to keep doing) or `avoid` (a thing to keep not doing).
export function addHabit(db, { name, kind }) {
	return insertRow(db, "habits", { id: uuidv7(), name: name.trim(), kind, created_at: Date.now(), deleted_at: null })
}

// Soft: the ticks stay, so the history is still there if the habit comes back.
export function removeHabit(db, id) {
	return updateRow(db, "habits", { id }, { deleted_at: Date.now() })
}

// Every live tick on `day`, oldest first, for habits that still exist.
export function ticksOn(db, day) {
	return db.sql`SELECT t.* FROM habit_ticks t JOIN habits h ON h.id = t.habit_id
		WHERE t.day = ${day} AND t.deleted_at IS NULL AND h.deleted_at IS NULL
		ORDER BY t.created_at`
}

// A person's tick. It wins over any proposal for as long as it exists.
export function tick(db, habitId, day, value) {
	return insertRow(db, "habit_ticks", {
		id: uuidv7(),
		habit_id: habitId,
		day,
		value,
		by: "manual",
		model: null,
		prompt_version: null,
		reasoning: null,
		created_at: Date.now(),
		deleted_at: null,
	})
}

// Removes the person's ticks for that day only. A proposal underneath, if any,
// shows again — a manual tick wins while it exists, not forever.
export async function untick(db, habitId, day) {
	const mine = await db.sql`SELECT id FROM habit_ticks
		WHERE habit_id = ${habitId} AND day = ${day} AND by = 'manual' AND deleted_at IS NULL`
	for (const { id } of mine) {
		await updateRow(db, "habit_ticks", { id }, { deleted_at: Date.now() })
	}
}

// Live ticks in a day range, oldest first — what the per-day strip is built from.
export function grid(db, fromDay, toDay) {
	return db.sql`SELECT habit_id, day, value, by, created_at FROM habit_ticks
		WHERE day BETWEEN ${fromDay} AND ${toDay} AND deleted_at IS NULL
		ORDER BY created_at`
}
