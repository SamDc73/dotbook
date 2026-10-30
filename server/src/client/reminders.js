// Reminder routes for the web client — the rows live in
// server/src/db/reminders.js. Covers what app/db/reminders.web.js calls:
// list, create, soft delete, restore, answers, and the coming window's fires
// for the tab-open notifications the browser schedules itself
// (app/notifications/reminders.web.js ← plan).

import {
	addReminder,
	allReminders,
	answersOn,
	entryReminder,
	recordAnswer,
	removeReminder,
	restoreReminder,
} from "../db/reminders.js"
import { isoLocal, midnight } from "../wallClock.js"

export function reminders(app) {
	app.get("/api/v1/reminders", async (c) => {
		return c.json({ reminders: await allReminders(c.get("db")) })
	})

	app.post("/api/v1/reminders", async (c) => {
		const body = await c.req.json().catch(() => ({}))
		const { templateId = null, entryId = null, at = null, escalationMin = null, style = "notify" } = body
		if (Boolean(templateId) === Boolean(entryId)) {
			return c.json({ error: "exactly one of templateId / entryId" }, 400)
		}
		const db = c.get("db")
		const id = await addReminder(db, c.get("auth").user.id, { templateId, entryId, at, escalationMin, style })
		return c.json({ reminder: await db.get("SELECT * FROM reminders WHERE id = ?", [id]) }, 201)
	})

	app.delete("/api/v1/reminders/:id", async (c) => {
		await removeReminder(c.get("db"), c.get("auth").user.id, c.req.param("id"))
		return c.body(null, 204)
	})

	app.post("/api/v1/reminders/:id/restore", async (c) => {
		await restoreReminder(c.get("db"), c.get("auth").user.id, c.req.param("id"))
		return c.body(null, 204)
	})

	app.post("/api/v1/reminders/answers", async (c) => {
		const { reminderId, day, answer, key } = await c.req.json().catch(() => ({}))
		if (!reminderId || !day || !answer || !key) {
			return c.json({ error: "expected { reminderId, day, answer, key }" }, 400)
		}
		const first = await recordAnswer(c.get("db"), c.get("auth").user.id, { reminderId, day, answer, key })
		return c.json({ first }, 201)
	})

	app.get("/api/v1/reminders/answered", async (c) => {
		return c.json({ answers: await answersOn(c.get("db"), c.req.query("day")) })
	})

	app.get("/api/v1/reminders/entry/:entryId", async (c) => {
		const reminder = await entryReminder(c.get("db"), c.req.param("entryId"))
		return c.json({ reminder: reminder ?? null })
	})

	// Every fire between `from` and `to` (epoch ms): a template reminder at its
	// HH:MM on each covered day, an entry reminder at the block's own time.
	app.get("/api/v1/reminders/plan", async (c) => {
		const from = Number(c.req.query("from"))
		const to = Number(c.req.query("to"))
		if (!Number.isFinite(from) || !Number.isFinite(to) || from > to) {
			return c.json({ error: "expected ?from&to as epoch ms" }, 400)
		}
		const fires = []
		for (const reminder of await allReminders(c.get("db"))) {
			if (reminder.template_id) {
				if (!reminder.at) continue
				for (let day = isoLocal(from); midnight(day) <= to; day = nextDay(day)) {
					const ts = Date.parse(`${day}T${reminder.at}:00`)
					if (ts >= from && ts <= to) {
						fires.push({ id: reminder.id, entryId: null, title: reminder.template_name, body: "", at: ts })
					}
				}
			} else if (reminder.entry_id) {
				if (reminder.entry_ts !== null && reminder.entry_ts >= from && reminder.entry_ts <= to) {
					fires.push({
						id: reminder.id,
						entryId: reminder.entry_id,
						title: reminder.todo_text ?? reminder.entry_text,
						body: "",
						at: reminder.entry_ts,
					})
				}
			}
		}
		return c.json({ reminders: fires })
	})
}

function nextDay(day) {
	const [y, m, d] = day.split("-").map(Number)
	return isoLocal(new Date(y, m - 1, d + 1).getTime())
}
