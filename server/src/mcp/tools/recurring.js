// Recurring events — a rule ("class every Tue/Thu at 2 pm") whose occurrences
// become ordinary lines on each day.

import { parseLineTime } from "@dotbook/core/parse"
import { renderLine } from "@dotbook/core/recurrence"
import * as z from "zod/v4"
import { addRecurrence, removeRecurrence, rulesWithParts } from "../../db/recurrences.js"
import { today, zone } from "../../wallClock.js"
import { idOf, OPTIONAL_DAY, READ_ONLY, REMOVES, WRITES } from "../fields.js"
import { reply } from "../reply.js"

const MINUTE_MS = 60 * 1000

// `line` is how each occurrence will read in the log: `2:00 -> 3:30 pm class`.
function rule(row) {
	const end = row.duration_min ? row.dtstart + row.duration_min * MINUTE_MS : null
	return {
		id: row.id,
		line: renderLine(row.text, row.dtstart, end, row.tzid),
		kind: row.kind,
		freq: row.parts.freq,
		interval: row.parts.interval,
		byDay: row.parts.byDay,
		startDay: row.parts.dtstart,
		durationMin: row.duration_min,
		timezone: row.tzid,
		source: row.source,
	}
}

// A time of day as the line parser reads it — `2:00 pm` or `14:00`.
function timeOfDay(time, day) {
	const { tsStart, timeText } = parseLineTime(time, day)
	if (tsStart === null || timeText.trim() !== time.trim()) {
		throw new Error(`"${time}" is not a time of day — write it like \`2:00 pm\`.`)
	}
	const at = new Date(tsStart)
	return { hour: at.getHours(), minute: at.getMinutes() }
}

export function registerRecurringTools(server, { db, groupId, canWrite }) {
	server.registerTool(
		"list_recurring",
		{
			title: "List recurring events",
			description:
				"Every recurring event rule. `line` is how each occurrence reads in the log; `byDay` uses MO TU WE TH FR SA SU.",
			inputSchema: z.object({}),
			annotations: READ_ONLY,
		},
		async () => reply((await rulesWithParts(db)).map(rule))
	)

	if (!canWrite) return

	server.registerTool(
		"add_recurring",
		{
			title: "Add a recurring event",
			description:
				"A rule whose occurrences appear as lines on each matching day, e.g. a class every Tuesday and " +
				`Thursday at 2:00 pm for 90 minutes. Times are read in ${zone()}.`,
			inputSchema: z.object({
				text: z.string().min(1).describe("The line's text, without a time — e.g. `Praxology class`"),
				freq: z.enum(["daily", "weekly", "monthly"]),
				interval: z.number().int().min(1).optional().describe("Every n days/weeks/months; 1 when left out"),
				byDay: z
					.array(z.enum(["MO", "TU", "WE", "TH", "FR", "SA", "SU"]))
					.optional()
					.describe("For weekly rules: which weekdays"),
				time: z.string().min(1).describe("Time of day, e.g. `2:00 pm`"),
				startDay: OPTIONAL_DAY.describe("The first day of the series; today when left out"),
				durationMin: z.number().int().min(1).optional().describe("Length in minutes; a point in time when left out"),
				kind: z.enum(["plan", "log"]).optional().describe("`plan` (the default) until confirmed, or `log` outright"),
			}),
			annotations: WRITES,
		},
		async ({ text, freq, interval, byDay, time, startDay, durationMin, kind }) => {
			const dtstart = startDay ?? today()
			const parts = { freq, interval, byDay, ...timeOfDay(time, dtstart), dtstart }
			const row = await addRecurrence(db, groupId, {
				text,
				parts,
				durationMin: durationMin ?? null,
				kind: kind ?? "plan",
			})
			return reply(rule(row))
		}
	)

	server.registerTool(
		"remove_recurring",
		{
			title: "Remove a recurring event",
			description: "End a recurring event. Lines already written for past days stay in the log.",
			inputSchema: z.object({ id: idOf("recurring event") }),
			annotations: REMOVES,
		},
		async ({ id }) => reply({ removed: (await removeRecurrence(db, groupId, id)).text })
	)
}
