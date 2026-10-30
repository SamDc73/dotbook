import { api } from "../lib/api"
import { noteChange } from "../lib/changes"
import { today } from "../lib/day"

// Web twin of db/habits.js: habits and their ticks, ticks being rows per
// (habit, day) with `by` saying who wrote them. Nothing here ranks them —
// `effectiveTick` in @dotbook/core/habits does, on the screen, exactly as
// natively. The `db` parameter is accepted and ignored. Every mutating call
// ends with noteChange().

export async function habits(_db) {
	const data = await api(`/api/v1/habits?day=${encodeURIComponent(today())}`)
	return data.habits
}

// `kind`: `do` (a thing to keep doing) or `avoid` (a thing to keep not doing).
export async function addHabit(_db, { name, kind }) {
	const data = await api("/api/v1/habits", { method: "POST", body: { name, kind } })
	noteChange()
	return data.habit
}

// Soft: the ticks stay, so the history is still there if the habit comes back.
export async function removeHabit(_db, id) {
	await api(`/api/v1/habits/${id}`, { method: "DELETE" })
	noteChange()
}

// Undo for removeHabit; its ticks never left.
export async function restoreHabit(_db, id) {
	await api(`/api/v1/habits/${id}/restore`, { method: "POST" })
	noteChange()
}

// Every live tick on `day`, oldest first. CONTRACT NOTE: the endpoint has no
// single-day read, so this filters the day's grid slice to the day itself.
export async function ticksOn(db, day) {
	const rows = await grid(db, day, day)
	return rows.filter((row) => row.day === day)
}

// A person's tick. It wins over any proposal for as long as it exists.
export async function tick(_db, habitId, day, value) {
	await api("/api/v1/habit-ticks", { method: "POST", body: { habitId, day, value } })
	noteChange()
}

// Removes the person's ticks for that day only. A proposal underneath, if any,
// shows again. CONTRACT NOTE: the tick endpoint is the only write, so the
// removal travels as `value: null` — the server must treat that as "retire the
// manual ticks for this habit and day", not as a tick of null.
export async function untick(_db, habitId, day) {
	await api("/api/v1/habit-ticks", { method: "POST", body: { habitId, day, value: null } })
	noteChange()
}

// A tap on a day cell, the way uHabits' checkmark works for a yes/no habit:
// unknown → yes → no → unknown. A proposal is accepted as it stands on the
// first tap — yes stays yes — and the cycle continues from there. `current` is
// the effective tick for that habit and day, or null. Returns the value the
// cell now holds, or null when it went back to unknown.
export async function cycleTick(db, habitId, day, current) {
	await untick(db, habitId, day)
	const next = nextTick(current)
	if (next !== null) await tick(db, habitId, day, next)
	return next
}

function nextTick(current) {
	if (current?.by === "llm") return current.value
	if (!current) return "kept"
	if (current.value === "kept") return "broken"
	return null
}

// Live ticks in a day range, oldest first — what the grid is built from.
// CONTRACT NOTE: the endpoint takes one `day`, so the range's last day is what
// is asked for and `fromDay` rides along as `from`; the server should return
// the whole window the screen asked for (the habits screen wants 28 days).
export async function grid(_db, fromDay, toDay) {
	const data = await api(`/api/v1/habits?day=${encodeURIComponent(toDay)}&from=${encodeURIComponent(fromDay)}`)
	return data.grid
}
