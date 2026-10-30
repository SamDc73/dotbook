// Timers over HTTP for the web client — the countdown on the Today screen. Runs
// after the bearer gate, so `auth` and `db` are set; `groupId` is the user's id.
//
// A timer is an `entries` row (AGENTS.md → "Timers are rows"), so its state is
// always read back from the log: the running one is `ts_end > now` and not
// deleted, and remaining time is `ts_end - now`. Stops and abandons bypass
// `editEntry` (which refuses a timer's text) and publish the column directly,
// exactly as app/db/timers.js updates the row.

import { abandonTimer, activeTimer, restoreTimer, startTimer, stopTimer, suggestions } from "../db/timers.js"
import { today } from "../wallClock.js"

const DAY = /^\d{4}-\d{2}-\d{2}$/
const MAX_MINUTES = 24 * 60

export function timers(app) {
	// The running timer, if one is going, and the durations worth offering.
	app.get("/api/v1/timers", async (c) => {
		const db = c.get("db")
		const now = Date.now()
		return c.json({ active: await activeTimer(db, now), suggestions: await suggestions(db, now) })
	})

	// `minutes` is the chip the person picked, or a number they typed. `todoId`
	// attaches the time to that todo while it is open, as the app's active todo does.
	app.post(
		"/api/v1/timers",
		handled(async (c) => {
			const { day, text, minutes, todoId } = await body(c)
			if (typeof text !== "string" || text.trim() === "") {
				return c.json({ error: "expected { day?, text, minutes, todoId? }" }, 400)
			}
			if (!Number.isInteger(minutes) || minutes < 1 || minutes > MAX_MINUTES) {
				return c.json({ error: `minutes is a whole number of minutes, 1–${MAX_MINUTES}` }, 400)
			}
			if (day !== undefined && !DAY.test(day)) {
				return c.json({ error: "a day is YYYY-MM-DD" }, 400)
			}
			const entry = await startTimer(c.get("db"), c.get("auth").user.id, {
				day: day ?? today(),
				text,
				minutes,
				todoId: todoId ?? null,
			})
			return c.json({ entry }, 201)
		})
	)

	app.post(
		"/api/v1/timers/:id/stop",
		handled(async (c) => {
			await stopTimer(c.get("db"), c.get("auth").user.id, c.req.param("id"))
			return c.body(null, 204)
		})
	)

	app.post(
		"/api/v1/timers/:id/abandon",
		handled(async (c) => {
			await abandonTimer(c.get("db"), c.get("auth").user.id, c.req.param("id"))
			return c.body(null, 204)
		})
	)

	// Undo for an abandon: the same row, live again.
	app.post(
		"/api/v1/timers/:id/restore",
		handled(async (c) => {
			await restoreTimer(c.get("db"), c.get("auth").user.id, c.req.param("id"))
			return c.body(null, 204)
		})
	)
}

// A stale id is the client's to fix: 404 with the db module's own message.
function handled(fn) {
	return async (c) => {
		try {
			return await fn(c)
		} catch (error) {
			if (!error.message?.startsWith("No timer")) {
				throw error
			}
			return c.json({ error: error.message }, 404)
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
