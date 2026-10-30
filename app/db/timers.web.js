import { api } from "../lib/api"
import { noteChange } from "../lib/changes"
import { activeTodoId } from "./todos.web"

// Web twin of db/timers.js: a timer is a row on the server, not runtime state
// (AGENTS.md → "Timers are rows") — remaining time is always ts_end − now read
// back from the row. The `db` parameter is accepted and ignored. Every
// mutating call ends with noteChange().

// Working on a todo? Its time is this timer's: the active todo's id travels
// with the request, and the server makes the link the native sibling makes in
// linkTimerToActiveTodo — it decides there whether the todo is still open.
export async function startTimer(_db, { minutes, text }) {
	const todoId = await activeTodoId()
	const data = await api("/api/v1/timers", { method: "POST", body: { text, minutes, todoId } })
	noteChange()
	return data.entry.id
}

// Completing writes ts_end as it actually happened.
export async function stopTimer(_db, entry) {
	await api(`/api/v1/timers/${entry.id}/stop`, { method: "POST" })
	noteChange()
}

// Abandoning is a soft delete, not a silent disappearance.
export async function abandonTimer(_db, entry) {
	await api(`/api/v1/timers/${entry.id}/abandon`, { method: "POST" })
	noteChange()
}

// Undo for abandonTimer: live again, with its end still ahead of it or not as
// the server finds it.
export async function restoreTimer(_db, entry) {
	await api(`/api/v1/timers/${entry.id}/restore`, { method: "POST" })
	noteChange()
}

// The duration is offered, never demanded: the plan you already wrote, then
// what you usually do. CONTRACT NOTE: the query takes no `day`/`now`, so the
// suggestions are computed against the server's clock — the day being viewed
// (a past day's next block) is lost. Nothing on the screens offers timers for
// past days today, so this is invisible for now.
export async function suggestions(_db, _day, _now) {
	const data = await api("/api/v1/timers")
	return data.suggestions
}
