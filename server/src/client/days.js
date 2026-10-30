// The day view over HTTP for the web client: what changed, which days have
// lines, and one day as the Today screen reads it. Runs after the bearer gate,
// so `auth` and `db` are set; `groupId` is the user's own id.
//
// The day read is the app's own: recurring events are materialised first (as a
// phone does when a day is opened), then the lines come from `dayPage` — the
// same joins app/db/entries.js `entriesForDay` makes — and the todos from
// `todosForDay`. A browser therefore sees what a phone sees.

import { dayPage } from "../db/entries.js"
import { materializeDay } from "../db/recurrences-materialize.js"
import { todosForDay } from "../db/todos.js"

const DAY = /^\d{4}-\d{2}-\d{2}$/

export function days(app) {
	// The newest message's timestamp: a thin client can tell a stale view from a
	// fresh one with one small read, without a sync round.
	app.get("/api/v1/state", async (c) => {
		const row = await c.get("db").get("SELECT max(timestamp) AS version FROM messages_crdt")
		return c.json({ version: row?.version ?? null })
	})

	// Every day with at least one live line, newest first — the day picker's list.
	app.get("/api/v1/days", async (c) => {
		const rows = await c.get("db").all("SELECT DISTINCT day FROM entries WHERE deleted_at IS NULL ORDER BY day DESC")
		return c.json({ days: rows.map((row) => row.day) })
	})

	// One day as the Today screen reads it. Materialising is idempotent, so this
	// is safe to call on every open, as the app does.
	app.get("/api/v1/days/:day/entries", async (c) => {
		const day = c.req.param("day")
		if (!DAY.test(day)) {
			return c.json({ error: "a day is YYYY-MM-DD" }, 400)
		}
		const db = c.get("db")
		await materializeDay(db, c.get("auth").user.id, day)
		return c.json({ entries: await dayPage(db, day), todos: await todosForDay(db, day) })
	})
}
