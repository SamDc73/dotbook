// The log's lines over HTTP for the web client: add, edit, confirm a plan,
// delete, and undo the delete. Every route runs after the bearer gate (app.js),
// so `auth` and `db` are already set; `groupId` is the user's own id.
//
// The work itself is server/src/db/entries.js — the same functions the MCP tools
// call — so a line written here is the line the app would have written. Rows go
// out as the database returns them: snake_case, times as epoch ms.

import { addEntry, confirmPlan, deleteEntry, editEntry, restoreEntry } from "../db/entries.js"
import { today } from "../wallClock.js"

const DAY = /^\d{4}-\d{2}-\d{2}$/

export function lines(app) {
	// A line typed in the composer. A line without a time, on today, is stamped
	// with now — `addEntry` does that, and decides plan vs log from the time.
	app.post(
		"/api/v1/lines",
		handled(async (c) => {
			const { day, text, kind } = await body(c)
			if (typeof text !== "string" || text.trim() === "") {
				return c.json({ error: "expected { day?, text, kind? }" }, 400)
			}
			if (day !== undefined && !DAY.test(day)) {
				return c.json({ error: "a day is YYYY-MM-DD" }, 400)
			}
			const entry = await addEntry(c.get("db"), c.get("auth").user.id, {
				day: day ?? today(),
				text,
				kind: kind ?? null,
				source: "web",
			})
			return c.json({ entry }, 201)
		})
	)

	// Replace a line's whole text; its time and kind are read again from it.
	app.patch(
		"/api/v1/lines/:id",
		handled(async (c) => {
			const { text } = await body(c)
			if (typeof text !== "string") {
				return c.json({ error: "expected { text }" }, 400)
			}
			await editEntry(c.get("db"), c.get("auth").user.id, c.req.param("id"), text)
			return c.body(null, 204)
		})
	)

	// "Did it?" — a plan line becomes a log line.
	app.post(
		"/api/v1/lines/:id/confirm",
		handled(async (c) => {
			await confirmPlan(c.get("db"), c.get("auth").user.id, c.req.param("id"))
			return c.body(null, 204)
		})
	)

	app.delete(
		"/api/v1/lines/:id",
		handled(async (c) => {
			await deleteEntry(c.get("db"), c.get("auth").user.id, c.req.param("id"))
			return c.body(null, 204)
		})
	)

	// Undo for a delete: the same row, live again.
	app.post(
		"/api/v1/lines/:id/restore",
		handled(async (c) => {
			await restoreEntry(c.get("db"), c.get("auth").user.id, c.req.param("id"))
			return c.body(null, 204)
		})
	)
}

// A refusal from a db module is the client's to fix — a stale id, a timer sent to
// the text editor — so it answers 4xx with the module's own message. Anything
// else is a real fault and surfaces as a 500 rather than hiding behind a 400.
const REFUSALS = ["No line with id ", "That line is a ", "A line is plain text"]

function handled(fn) {
	return async (c) => {
		try {
			return await fn(c)
		} catch (error) {
			if (!REFUSALS.some((prefix) => error.message?.startsWith(prefix))) {
				throw error
			}
			return c.json({ error: error.message }, error.message.startsWith("No line") ? 404 : 400)
		}
	}
}

async function body(c) {
	try {
		return await c.req.json()
	} catch {
		return {}
	}
}
