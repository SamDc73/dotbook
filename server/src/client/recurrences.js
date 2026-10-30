// The web client's recurring-events API — the HTTP half of app/db/recurrences.js.
// A rule is a row; a device turns its occurrences into ordinary lines when it
// opens a day. The rule text (RRULE) and its expansion are
// @dotbook/core/recurrence, so the phone, the web app, and the server agree on
// every occurrence. Rules and instances sync, so every write goes through
// publish / publishUpdate.

import { parseLineTime } from "@dotbook/core/parse"
import { recurrencesFromIcs } from "@dotbook/core/recurrence"
import { uuidv7 } from "uuidv7"
import { addEntry } from "../db/entries.js"
import { addRecurrence, removeRecurrence, rulesWithParts } from "../db/recurrences.js"
import { publish, publishUpdate } from "../sync/publish.js"
import { today, zone } from "../wallClock.js"

const DAY = /^\d{4}-\d{2}-\d{2}$/
const FREQS = ["daily", "weekly", "monthly"]
const WEEKDAYS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"]
const KINDS = ["plan", "log"]

export function recurrences(app) {
	// Every live rule, with its parts read back (freq, byDay, hour, minute, start day).
	app.get("/api/v1/recurrences", async (c) => {
		return c.json({ recurrences: await rulesWithParts(c.get("db")) })
	})

	app.post("/api/v1/recurrences", async (c) => {
		const read = readFields(await body(c))
		if (read.error) {
			return c.json({ error: read.error }, 400)
		}
		const { db, groupId } = mine(c)
		const recurrence = await addRecurrence(db, groupId, read.fields)
		return c.json({ recurrence }, 201)
	})

	// Editing retires the old rule and starts a new one —
	// app/db/recurrences.js `replaceRecurrence`. Days already materialised keep
	// their lines (their instance rows point at the old rule), so a change to
	// the series never rewrites the past.
	app.put("/api/v1/recurrences/:id", async (c) => {
		const read = readFields(await body(c))
		if (read.error) {
			return c.json({ error: read.error }, 400)
		}
		const { db, groupId } = mine(c)
		const id = c.req.param("id")
		if (!(await liveRow(db, id))) {
			return c.json({ error: `no recurring event with id ${id}` }, 404)
		}
		await removeRecurrence(db, groupId, id)
		await addRecurrence(db, groupId, read.fields)
		return c.body(null, 204)
	})

	// Soft delete: lines already written for it stay — they happened, or were planned.
	app.delete("/api/v1/recurrences/:id", async (c) => {
		const { db, groupId } = mine(c)
		const id = c.req.param("id")
		if (!(await liveRow(db, id))) {
			return c.json({ error: `no recurring event with id ${id}` }, 404)
		}
		await removeRecurrence(db, groupId, id)
		return c.body(null, 204)
	})

	// Undo for the delete — the row still exists, soft-deleted.
	app.post("/api/v1/recurrences/:id/restore", async (c) => {
		const { db, groupId } = mine(c)
		const id = c.req.param("id")
		if (!(await db.get("SELECT 1 FROM recurrences WHERE id = ?", [id]))) {
			return c.json({ error: `no recurring event with id ${id}` }, 404)
		}
		await publishUpdate(db, groupId, "recurrences", { id }, { deleted_at: null })
		return c.body(null, 204)
	})

	// A timetable import — app/db/recurrences.js `importIcs`: repeating events
	// become rules, one-offs become ordinary lines (whose kind and time the
	// line parser decides, exactly as if they were typed), both marked import:ics.
	app.post("/api/v1/recurrences/ics", async (c) => {
		const { text } = await body(c)
		if (typeof text !== "string" || text.trim() === "") {
			return c.json({ error: "expected { text } — the .ics file's contents" }, 400)
		}
		let parsed
		try {
			parsed = recurrencesFromIcs(text, { tzid: zone() })
		} catch {
			return c.json({ error: "not a readable .ics file" }, 400)
		}
		const { db, groupId } = mine(c)
		for (const rule of parsed.recurrences) {
			await publish(db, groupId, "recurrences", [{ id: uuidv7(), ...rule, created_at: Date.now(), deleted_at: null }])
		}
		for (const line of parsed.oneOffs) {
			const entry = await addEntry(db, groupId, { day: line.day, text: line.text })
			await publishUpdate(db, groupId, "entries", { id: entry.id }, { source: "import:ics" })
		}
		return c.json({ added: parsed.recurrences.length + parsed.oneOffs.length })
	})
}

/** The auth'd caller's database and sync group. */
function mine(c) {
	return { db: c.get("db"), groupId: c.get("auth").user.id }
}

async function body(c) {
	return c.req.json().catch(() => ({}))
}

async function liveRow(db, id) {
	return db.get("SELECT 1 FROM recurrences WHERE id = ? AND deleted_at IS NULL", [id])
}

// The form's fields (app/components/RecurrenceForm.jsx's output) cleaned — or
// `{ error }`. `time` reads the way the form reads it: `14:00`, `2:00`, `2:00 pm`.
function readFields(value) {
	const { text, freq, interval, byDay, time, startDay, durationMin, kind } = value ?? {}
	if (typeof text !== "string" || text.trim() === "") {
		return { error: "text is required" }
	}
	if (!FREQS.includes(freq)) {
		return { error: "freq is 'daily', 'weekly' or 'monthly'" }
	}
	if (interval !== undefined && (!Number.isInteger(interval) || interval < 1)) {
		return { error: "interval is a whole number of 1 or more" }
	}
	if (byDay !== undefined && !(Array.isArray(byDay) && byDay.every((code) => WEEKDAYS.includes(code)))) {
		return { error: "byDay uses the RFC two-letter codes, MO through SU" }
	}
	if (startDay !== undefined && !DAY.test(startDay)) {
		return { error: "startDay is 'YYYY-MM-DD'" }
	}
	if (durationMin !== undefined && durationMin !== null && (!Number.isInteger(durationMin) || durationMin < 1)) {
		return { error: "durationMin is a whole number of minutes" }
	}
	if (kind !== undefined && !KINDS.includes(kind)) {
		return { error: "kind is 'plan' or 'log'" }
	}
	const at = timeParts(time)
	if (!at) {
		return { error: "time reads like 14:00 or 2:00 pm" }
	}
	return {
		fields: {
			text,
			parts: {
				freq,
				interval: interval ?? 1,
				// Only a weekly rule means anything by weekday; the form empties it too.
				byDay: freq === "weekly" ? (byDay ?? []) : [],
				...at,
				dtstart: startDay ?? today(),
			},
			durationMin: durationMin ?? null,
			kind: kind ?? "plan",
		},
	}
}

/** `{ hour, minute }` from a time as typed, or null when it reads as neither. */
function timeParts(time) {
	if (typeof time !== "string") {
		return null
	}
	const parsed = parseLineTime(`${time.trim()} x`, today())
	if (parsed.tsStart === null || parsed.tsEnd !== null) {
		return null
	}
	const at = new Date(parsed.tsStart)
	return { hour: at.getHours(), minute: at.getMinutes() }
}
