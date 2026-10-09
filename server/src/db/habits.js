// Habits and their ticks on the server — the MCP endpoint's half of what
// app/db/habits.js does on a device. A tick through the MCP endpoint is the
// person's own decision (`by: manual`), made through their AI tool, so it wins
// over the classifier's proposal exactly as a tap does. Which tick counts is
// `effectiveTick` from @dotbook/core/habits, so phone and server agree.

import { effectiveTick } from "@dotbook/core/habits"
import { uuidv7 } from "uuidv7"
import { publish, publishUpdate } from "../sync/publish.js"

export function habits(db) {
	return db.all("SELECT * FROM habits WHERE deleted_at IS NULL ORDER BY created_at")
}

async function liveHabit(db, id) {
	const habit = await db.get("SELECT * FROM habits WHERE id = ? AND deleted_at IS NULL", [id])
	if (!habit) {
		throw new Error(`No habit with id ${id} — list the habits again for current ids.`)
	}
	return habit
}

/** `kind`: `do` (keep doing it) or `avoid` (keep not doing it). @returns the new row */
export async function addHabit(db, groupId, { name, kind }) {
	const row = { id: uuidv7(), name: name.trim(), kind, created_at: Date.now(), deleted_at: null }
	await publish(db, groupId, "habits", [row])
	return row
}

/** Soft: the ticks stay, so the history is there if the habit comes back. */
export async function removeHabit(db, groupId, id) {
	const habit = await liveHabit(db, id)
	await publishUpdate(db, groupId, "habits", { id }, { deleted_at: Date.now() })
	return habit
}

/**
 * The person's verdict for one habit on one day: `kept`, `broken`, or null to
 * clear it. Their earlier ticks for that day are retired first, so one row per
 * decision stays live; clearing lets a proposal underneath show again.
 */
export async function setTick(db, groupId, habitId, day, value) {
	const habit = await liveHabit(db, habitId)
	const mine = await db.all(
		"SELECT id FROM habit_ticks WHERE habit_id = ? AND day = ? AND by = 'manual' AND deleted_at IS NULL",
		[habitId, day]
	)
	for (const { id } of mine) {
		await publishUpdate(db, groupId, "habit_ticks", { id }, { deleted_at: Date.now() })
	}
	if (value !== null) {
		await publish(db, groupId, "habit_ticks", [
			{
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
			},
		])
	}
	return habit
}

/**
 * The verdict that counts for every habit on every day from `from` to `to`:
 * `Map<habitId, Map<day, tick>>`, days with nothing decided left out.
 */
export async function verdicts(db, from, to) {
	const ticks = await db.all(
		`SELECT habit_id, day, value, by, reasoning, created_at FROM habit_ticks
		WHERE day BETWEEN ? AND ? AND deleted_at IS NULL`,
		[from, to]
	)
	const grouped = new Map()
	for (const tick of ticks) {
		const days = grouped.get(tick.habit_id) ?? new Map()
		days.set(tick.day, [...(days.get(tick.day) ?? []), tick])
		grouped.set(tick.habit_id, days)
	}
	for (const days of grouped.values()) {
		for (const [day, dayTicks] of days) {
			days.set(day, effectiveTick(dayTicks))
		}
	}
	return grouped
}
