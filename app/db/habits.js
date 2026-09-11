import { uuidv7 } from "uuidv7"

// Habits and their ticks. A tick is a row per (habit, day) with `by` saying who
// wrote it: a person (`manual`) or the classifier (`llm`). Nothing here ranks
// them — `effectiveTick` in @dotbook/core/habits does, so phone and server agree.
// See V0.1 → feature 6.

export function habits(db) {
	return db.sql`SELECT * FROM habits WHERE deleted_at IS NULL ORDER BY created_at`
}

// `kind`: `do` (a thing to keep doing) or `avoid` (a thing to keep not doing).
export function addHabit(db, { name, kind }) {
	return db.sql`INSERT INTO habits (id, name, kind, created_at) VALUES (${uuidv7()}, ${name.trim()}, ${kind}, ${Date.now()})`
}

// Soft: the ticks stay, so the history is still there if the habit comes back.
export function removeHabit(db, id) {
	return db.sql`UPDATE habits SET deleted_at = ${Date.now()} WHERE id = ${id}`
}

// Every live tick on `day`, oldest first, for habits that still exist.
export function ticksOn(db, day) {
	return db.sql`SELECT t.* FROM habit_ticks t JOIN habits h ON h.id = t.habit_id
		WHERE t.day = ${day} AND t.deleted_at IS NULL AND h.deleted_at IS NULL
		ORDER BY t.created_at`
}

// A person's tick. It wins over any proposal for as long as it exists.
export function tick(db, habitId, day, value) {
	return db.sql`INSERT INTO habit_ticks (id, habit_id, day, value, by, created_at)
		VALUES (${uuidv7()}, ${habitId}, ${day}, ${value}, 'manual', ${Date.now()})`
}

// Removes the person's ticks for that day only. A proposal underneath, if any,
// shows again — a manual tick wins while it exists, not forever.
export function untick(db, habitId, day) {
	return db.sql`UPDATE habit_ticks SET deleted_at = ${Date.now()}
		WHERE habit_id = ${habitId} AND day = ${day} AND by = 'manual' AND deleted_at IS NULL`
}

// Live ticks in a day range, oldest first — what the per-day strip is built from.
export function grid(db, fromDay, toDay) {
	return db.sql`SELECT habit_id, day, value, by, created_at FROM habit_ticks
		WHERE day BETWEEN ${fromDay} AND ${toDay} AND deleted_at IS NULL
		ORDER BY created_at`
}
