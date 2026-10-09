// One day, everything on it — the AI tool's Today screen in one call.

import * as z from "zod/v4"
import { entriesForDay } from "../../db/entries.js"
import { habits, verdicts } from "../../db/habits.js"
import { dailyActivity, dailyVitals, screenTime, sleepSessions } from "../../db/passive.js"
import { pendingOccurrences } from "../../db/recurrences.js"
import { todosForDay } from "../../db/todos.js"
import { isoLocal, today, zone } from "../../wallClock.js"
import { OPTIONAL_DAY, READ_ONLY } from "../fields.js"
import { line, reply, todo } from "../reply.js"
import { measures, sleep } from "./passive.js"

export function registerDayTools(server, { db }) {
	server.registerTool(
		"get_day",
		{
			title: "Read a day",
			description:
				"Everything on one day: its lines in time order (`log` = happened, `plan` = intended, `timer`), " +
				"the open todos it shows, recurring events not yet in the log, each habit's verdict, and the ring's " +
				"and screen time's numbers. Start here for any question about a day, or before planning one.",
			inputSchema: z.object({ day: OPTIONAL_DAY }),
			annotations: READ_ONLY,
		},
		async ({ day: asked }) => {
			const day = asked ?? today()
			const decided = await verdicts(db, day, day)
			return reply({
				day,
				today: today(),
				now: isoLocal(Date.now()),
				timezone: zone(),
				lines: (await entriesForDay(db, day)).map(line),
				todos: (await todosForDay(db, day)).map(todo),
				recurring: (await pendingOccurrences(db, day)).map((occurrence) => ({
					recurringId: occurrence.recurrence_id,
					kind: occurrence.kind,
					text: occurrence.text,
					start: isoLocal(occurrence.ts_start),
					end: isoLocal(occurrence.ts_end),
				})),
				habits: (await habits(db)).map((habit) => {
					const tick = decided.get(habit.id)?.get(day) ?? null
					return {
						id: habit.id,
						name: habit.name,
						kind: habit.kind,
						verdict: tick && { value: tick.value, by: tick.by, reasoning: tick.reasoning ?? undefined },
					}
				}),
				sleep: (await sleepSessions(db, day, day)).map(sleep),
				vitals: (await dailyVitals(db, day, day)).map(measures)[0] ?? null,
				activity: (await dailyActivity(db, day, day)).map(measures)[0] ?? null,
				screenTime: await screenTime(db, day, day),
			})
		}
	)
}
