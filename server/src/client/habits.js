// The web client's habits API — the HTTP half of what app/db/habits.js and the
// habits screen do on a device. Reads are plain SQL against this user's
// replica; every write goes through publish/publishUpdate (../sync/publish.js),
// so the phone, the web app, and the server agree on every habit and tick.
//
// The habits read hands back the window's tick rows exactly as app/db/habits.js
// `grid` reads them; the screen resolves the tick that counts itself
// (`effectiveTick` from @dotbook/core/habits), on the phone and in the browser.

import { SYNCED } from "@dotbook/core/sync"
import { addHabit, removeHabit, setTick } from "../db/habits.js"
import { publishUpdate } from "../sync/publish.js"
import { shiftDay, today } from "../wallClock.js"

// Four weeks of cells, as the habits screen lays them out; older days scroll off.
const DAYS = 28

// The habits columns a client may edit — the synced ones except the stamps
// (created_at, deleted_at), which are the system's, never the form's.
const EDITABLE = SYNCED.habits.columns.filter((column) => !["created_at", "deleted_at"].includes(column))

const DAY = /^\d{4}-\d{2}-\d{2}$/

/** What the client sends to wipe a day back to unknown. */
const CLEAR = "clear"

export function habits(app) {
	app.get("/api/v1/habits", async (c) => {
		const day = dayOf(c)
		if (day === null) {
			return c.json({ error: "day is 'YYYY-MM-DD'" }, 400)
		}
		const db = c.get("db")
		// app/db/habits.js `grid`'s query, over the window the screen asks for.
		const fromDay = c.req.query("from") ?? shiftDay(day, 1 - DAYS)
		if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDay)) {
			return c.json({ error: "from is 'YYYY-MM-DD'" }, 400)
		}
		const [list, history] = await Promise.all([
			db.all("SELECT * FROM habits WHERE deleted_at IS NULL ORDER BY created_at"),
			db.all(
				`SELECT habit_id, day, value, by, created_at FROM habit_ticks
				WHERE day BETWEEN ? AND ? AND deleted_at IS NULL
				ORDER BY created_at`,
				[fromDay, day]
			),
		])
		return c.json({ habits: list, ticks: history })
	})

	app.post("/api/v1/habits", async (c) => {
		const { name, kind } = await body(c)
		if (typeof name !== "string" || name.trim() === "" || (kind !== "do" && kind !== "avoid")) {
			return c.json({ error: "expected { name, kind: 'do' | 'avoid' }" }, 400)
		}
		const { db, groupId } = mine(c)
		const habit = await addHabit(db, groupId, { name, kind })
		return c.json({ habit }, 201)
	})

	app.patch("/api/v1/habits/:id", async (c) => {
		const changes = patchOf(await body(c))
		if (changes.error) {
			return c.json({ error: changes.error }, 400)
		}
		const { db, groupId } = mine(c)
		const id = c.req.param("id")
		if (!(await liveRow(db, id))) {
			return c.json({ error: `no habit with id ${id}` }, 404)
		}
		await publishUpdate(db, groupId, "habits", { id }, changes.fields)
		return c.body(null, 204)
	})

	// Soft: the ticks stay, so the history is there if the habit comes back.
	app.delete("/api/v1/habits/:id", async (c) => {
		const { db, groupId } = mine(c)
		const id = c.req.param("id")
		if (!(await liveRow(db, id))) {
			return c.json({ error: `no habit with id ${id}` }, 404)
		}
		await removeHabit(db, groupId, id)
		return c.body(null, 204)
	})

	// Undo for the delete — the row still exists, soft-deleted.
	app.post("/api/v1/habits/:id/restore", async (c) => {
		const { db, groupId } = mine(c)
		const id = c.req.param("id")
		if (!(await db.get("SELECT 1 FROM habits WHERE id = ?", [id]))) {
			return c.json({ error: `no habit with id ${id}` }, 404)
		}
		await publishUpdate(db, groupId, "habits", { id }, { deleted_at: null })
		return c.body(null, 204)
	})

	// The person's verdict for one habit on one day. `clear` retires their
	// earlier ticks for the day, so a proposal underneath can show again —
	// that is app/db/habits.js `cycleTick`'s unknown state.
	app.post("/api/v1/habit-ticks", async (c) => {
		const { habitId, day, value } = await body(c)
		if (typeof habitId !== "string" || !DAY.test(day ?? "") || !["kept", "broken", CLEAR].includes(value)) {
			return c.json({ error: "expected { habitId, day: 'YYYY-MM-DD', value: 'kept' | 'broken' | 'clear' }" }, 400)
		}
		const { db, groupId } = mine(c)
		if (!(await liveRow(db, habitId))) {
			return c.json({ error: `no habit with id ${habitId}` }, 404)
		}
		await setTick(db, groupId, habitId, day, value === CLEAR ? null : value)
		return c.body(null, 204)
	})
}

/** The auth'd caller's database and sync group. */
function mine(c) {
	return { db: c.get("db"), groupId: c.get("auth").user.id }
}

async function body(c) {
	return c.req.json().catch(() => ({}))
}

/** The `day` query parameter, or null when it is there but malformed. */
function dayOf(c) {
	const day = c.req.query("day")
	if (day === undefined || day === null || day === "") {
		return today()
	}
	return DAY.test(day) ? day : null
}

/** The provided columns a client may change, validated — or `{ error }`. */
function patchOf(bodyValue) {
	const fields = {}
	for (const [column, value] of Object.entries(bodyValue ?? {})) {
		if (!EDITABLE.includes(column) || value === undefined) {
			continue
		}
		if (column === "kind" && value !== "do" && value !== "avoid") {
			return { error: "kind is 'do' or 'avoid'" }
		}
		if (column === "name" && (typeof value !== "string" || value.trim() === "")) {
			return { error: "name is a non-empty string" }
		}
		fields[column] = value
	}
	if (Object.keys(fields).length === 0) {
		return { error: "expected { name?, kind? }" }
	}
	return { fields }
}

async function liveRow(db, id) {
	return db.get("SELECT 1 FROM habits WHERE id = ? AND deleted_at IS NULL", [id])
}
