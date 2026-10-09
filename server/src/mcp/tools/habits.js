// Habits: the grid of verdicts, add and remove a habit, tick a day.

import * as z from "zod/v4"
import { addHabit, habits, removeHabit, setTick, verdicts } from "../../db/habits.js"
import { today } from "../../wallClock.js"
import { FROM, idOf, OPTIONAL_DAY, READ_ONLY, REMOVES, TO, WRITES } from "../fields.js"
import { range, reply } from "../reply.js"

export function registerHabitTools(server, { db, groupId, canWrite }) {
	server.registerTool(
		"list_habits",
		{
			title: "List habits",
			description:
				"Every habit (`do`: keep doing it, `avoid`: keep not doing it) with its verdict per day: `kept` or " +
				"`broken`, `by` the person (`manual`) or proposed by the classifier (`llm`, with its reasoning). " +
				"A person's verdict always wins. Days with no verdict are left out — absent is unknown, not broken.",
			inputSchema: z.object({ from: FROM, to: TO }),
			annotations: READ_ONLY,
		},
		async (args) => {
			const days = range(args)
			const all = await verdicts(db, days.from, days.to)
			const rows = await habits(db)
			return reply({
				...days,
				habits: rows.map((habit) => ({
					id: habit.id,
					name: habit.name,
					kind: habit.kind,
					days: [...(all.get(habit.id) ?? new Map())]
						.sort(([a], [b]) => a.localeCompare(b))
						.map(([day, tick]) => ({ day, value: tick.value, by: tick.by, reasoning: tick.reasoning ?? undefined })),
				})),
			})
		}
	)

	if (!canWrite) return

	server.registerTool(
		"tick_habit",
		{
			title: "Tick a habit",
			description:
				"Record the person's verdict for a habit on a day: `kept`, `broken`, or `clear` to remove theirs " +
				"(a classifier proposal underneath, if any, shows again).",
			inputSchema: z.object({
				habitId: idOf("habit"),
				value: z.enum(["kept", "broken", "clear"]),
				day: OPTIONAL_DAY,
			}),
			annotations: { ...WRITES, idempotentHint: true },
		},
		async ({ habitId, value, day = today() }) => {
			const habit = await setTick(db, groupId, habitId, day, value === "clear" ? null : value)
			return reply({ habit: habit.name, day, value: value === "clear" ? null : value })
		}
	)

	server.registerTool(
		"add_habit",
		{
			title: "Add a habit",
			description: "Track a new habit. `do`: something to keep doing (meditate); `avoid`: something to keep not doing.",
			inputSchema: z.object({ name: z.string().min(1), kind: z.enum(["do", "avoid"]) }),
			annotations: WRITES,
		},
		async ({ name, kind }) => {
			const habit = await addHabit(db, groupId, { name, kind })
			return reply({ id: habit.id, name: habit.name, kind: habit.kind })
		}
	)

	server.registerTool(
		"remove_habit",
		{
			title: "Remove a habit",
			description: "Stop tracking a habit. Its past verdicts are kept.",
			inputSchema: z.object({ id: idOf("habit") }),
			annotations: REMOVES,
		},
		async ({ id }) => reply({ removed: (await removeHabit(db, groupId, id)).name })
	)
}
