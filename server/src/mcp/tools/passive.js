// Passive data — the ring and screen time. Read only.

import * as z from "zod/v4"
import { dailyActivity, dailyVitals, screenTime, sleepSessions } from "../../db/passive.js"
import { isoLocal } from "../../wallClock.js"
import { FROM, READ_ONLY, TO } from "../fields.js"
import { range, reply } from "../reply.js"

/** Sleep as the ring reported it; minutes, and the night's edges as local times. */
export function sleep(row) {
	return {
		start: isoLocal(row.start_ts),
		end: isoLocal(row.end_ts),
		asleepAt: isoLocal(row.asleep_ts),
		wokeAt: isoLocal(row.wake_ts),
		asleepMin: row.asleep_min,
		awakeMin: row.awake_min,
		remMin: row.rem_min,
		lightMin: row.light_min,
		deepMin: row.deep_min,
		ratio: row.ratio,
	}
}

// Day rows lose their bookkeeping; every measure stays as stored, its name in
// camelCase (`avg_hrv` → `avgHrv`).
const BOOKKEEPING = new Set(["source", "created_at"])

export function measures(row) {
	return Object.fromEntries(
		Object.entries(row)
			.filter(([column]) => !BOOKKEEPING.has(column))
			.map(([column, value]) => [column.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()), value])
	)
}

export function registerPassiveTools(server, { db }) {
	server.registerTool(
		"get_passive_data",
		{
			title: "Ring and screen time",
			description:
				"What was recorded without being typed, per day range: sleep sessions (by the morning they ended), " +
				"daily heart rate / SpO2 / HRV, steps and kcal, and screen time in seconds — apps and sites apart. " +
				"Sites are a breakdown of the browser app's own time: never add the two lists together.",
			inputSchema: z.object({ from: FROM, to: TO }),
			annotations: READ_ONLY,
		},
		async (args) => {
			const days = range(args)
			return reply({
				...days,
				sleep: (await sleepSessions(db, days.from, days.to)).map(sleep),
				vitals: (await dailyVitals(db, days.from, days.to)).map(measures),
				activity: (await dailyActivity(db, days.from, days.to)).map(measures),
				screenTime: await screenTime(db, days.from, days.to),
			})
		}
	)
}
