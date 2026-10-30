// The odds and ends of the web client's API: screen-time read, the two file
// imports (RingConn CSV, the Markdown log), the Markdown export, and the focus
// view's blocks. Led in by the bearer gate like every client route.

import { parseRingconnCsv, RINGCONN_UPSERT } from "@dotbook/core/import"
import { uuidv7 } from "uuidv7"
import { activeCountdown, upNext } from "../db/blocks.js"
import { exportMarkdown, importMarkdown } from "../db/markdown.js"
import { rollupsOn } from "../db/screenTime.js"
import { publish, publishUpdate } from "../sync/publish.js"

const DAY = /^\d{4}-\d{2}-\d{2}$/
const RING_TABLE = { sleep: "sleep_sessions", vitals: "daily_vitals", activity: "daily_activity" }

export function io(app) {
	// The ScreenTime section: one day's rollups.
	app.get("/api/v1/screen-time", async (c) => {
		const day = c.req.query("day")
		if (!DAY.test(day)) return c.json({ error: "a day is YYYY-MM-DD" }, 400)
		return c.json({ rollups: await rollupsOn(c.get("db"), day) })
	})

	// A RingConn export, upserted row for row (core/import owns the parsing).
	app.post("/api/v1/import/ringconn", async (c) => {
		const tzid = c.req.query("tzid") || "UTC"
		const { kind, rows } = parseRingconnCsv(await c.req.text(), { tzid })
		const counts = { kind, inserted: 0, updated: 0, skipped: 0 }
		if (!kind) return c.json(counts)
		const db = c.get("db")
		const groupId = c.get("auth").user.id
		for (const row of rows) {
			const existing = await existingRow(db, kind, row)
			if (existing) {
				const changes = existing.source === "manual" ? {} : changed(measurements(kind, row), existing.row)
				if (Object.keys(changes).length === 0) {
					counts.skipped++
					continue
				}
				await publishUpdate(db, groupId, RING_TABLE[kind], existing.key, changes)
				counts.updated++
				continue
			}
			await publish(db, groupId, RING_TABLE[kind], [
				{ ...(kind === "sleep" ? { id: uuidv7() } : {}), ...row, created_at: Date.now() },
			])
			counts.inserted++
		}
		return c.json(counts)
	})

	// The whole log as one Markdown file (app/db/markdown.js's format, in core).
	app.get("/api/v1/export", async (c) => {
		const { text } = await exportMarkdown(c.get("db"))
		return c.body(text, 200, { "content-type": "text/markdown" })
	})

	// …and back in: every row that is not already there becomes a real row.
	app.post("/api/v1/import", async (c) => {
		const { markdown } = await c.req.json()
		if (typeof markdown !== "string") return c.json({ error: "expected { markdown }" }, 400)
		return c.json(await importMarkdown(c.get("db"), c.get("auth").user.id, markdown))
	})

	// What the focus view shows: the live countdown and the next plan block.
	app.get("/api/v1/blocks", async (c) => {
		const day = c.req.query("day")
		if (!DAY.test(day)) return c.json({ error: "a day is YYYY-MM-DD" }, 400)
		const now = Date.now()
		const active = await activeCountdown(c.get("db"), now)
		const next = await upNext(c.get("db"), now, day)
		return c.json({ active, upNext: next })
	})
}

// RingConn upserts: the row that already covers this measurement, or null.
// Manual rows win every tie — an import must never overwrite what a person typed.
async function existingRow(db, kind, row) {
	if (kind === "sleep") {
		const found = await db.get("SELECT * FROM sleep_sessions WHERE start_ts = ?", [row.start_ts])
		return found ? { key: { id: found.id }, source: found.source, row: found } : null
	}
	const table = kind === "vitals" ? "daily_vitals" : "daily_activity"
	const found = await db.get(`SELECT * FROM ${table} WHERE day = ?`, [row.day])
	return found ? { key: { day: row.day }, source: found.source, row: found } : null
}

/** Everything but the row's natural key — the columns an update may touch. */
function measurements(kind, row) {
	const natural = kind === "sleep" ? "start_ts" : "day"
	const { [natural]: _key, ...rest } = row
	return rest
}

function changed(next, stored) {
	const diff = {}
	for (const [col, val] of Object.entries(next)) {
		if (stored[col] !== val) diff[col] = val
	}
	return diff
}

// RINGCONN_UPSERT is re-exported so the route tests can assert against core's
// own column list rather than a copy here.
export { RINGCONN_UPSERT }
