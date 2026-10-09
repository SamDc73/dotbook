// The log's lines: search them, add, edit, delete, and confirm a plan.

import * as z from "zod/v4"
import { addEntry, confirmPlan, deleteEntry, editEntry, searchEntries } from "../../db/entries.js"
import { today } from "../../wallClock.js"
import { FROM, idOf, OPTIONAL_DAY, READ_ONLY, REMOVES, TO, WRITES } from "../fields.js"
import { line, range, reply } from "../reply.js"

const LINE_TEXT = z
	.string()
	.min(1)
	.describe(
		"The line exactly as typed in the app: an optional time first (`7:36 took nootstack`, " +
			"`8:30 -> 10:00 deep work`, `3:30 pm call`, `ytd 9pm …`), then what happened"
	)

export function registerLogTools(server, { db, groupId, canWrite }) {
	server.registerTool(
		"search_lines",
		{
			title: "Search the log",
			description:
				"Find lines (log, plan and timer) whose text contains the words, newest first. " +
				"Use it for questions like 'when did I last take X' or 'how often did I go to the gym'.",
			inputSchema: z.object({
				query: z.string().min(1).describe("Text to look for, any case"),
				from: FROM.describe("First day, YYYY-MM-DD; 30 days before `to` when left out"),
				to: TO,
				kind: z.enum(["log", "plan", "timer"]).optional().describe("Only lines of this kind"),
				limit: z.number().int().min(1).max(500).optional().describe("At most this many lines; 100 when left out"),
			}),
			annotations: READ_ONLY,
		},
		async (args) => {
			const days = range(args, 30)
			const rows = await searchEntries(db, {
				query: args.query,
				...days,
				kind: args.kind ?? null,
				limit: args.limit ?? 100,
			})
			return reply({ ...days, lines: rows.map(line) })
		}
	)

	if (!canWrite) return

	server.registerTool(
		"add_line",
		{
			title: "Log a line",
			description:
				"Write a line into the log, as if typed in the app. A line without a time, on today, is stamped " +
				"with the current time. A time still ahead makes it a plan; use add_plan to force one.",
			inputSchema: z.object({ text: LINE_TEXT, day: OPTIONAL_DAY }),
			annotations: WRITES,
		},
		async ({ text, day }) => reply(line(await addEntry(db, groupId, { day: day ?? today(), text })))
	)

	server.registerTool(
		"add_plan",
		{
			title: "Plan a block",
			description:
				"Write a plan line — a block the person intends to do, e.g. `2:00 pm -> 3:30 pm write report` " +
				"for tomorrow. It shows as a plan until it is confirmed (confirm_plan).",
			inputSchema: z.object({ text: LINE_TEXT, day: OPTIONAL_DAY }),
			annotations: WRITES,
		},
		async ({ text, day }) => reply(line(await addEntry(db, groupId, { day: day ?? today(), text, kind: "plan" })))
	)

	server.registerTool(
		"edit_line",
		{
			title: "Edit a line",
			description: "Replace a line's whole text. Its time and plan/log kind are read again from the new text.",
			inputSchema: z.object({ id: idOf("line"), text: LINE_TEXT }),
			annotations: { ...WRITES, idempotentHint: true },
		},
		async ({ id, text }) => reply(line(await editEntry(db, groupId, id, text)))
	)

	server.registerTool(
		"confirm_plan",
		{
			title: "Confirm a plan",
			description: "'Did it' — turn a plan line into a log line, as it happened.",
			inputSchema: z.object({ id: idOf("plan line") }),
			annotations: { ...WRITES, idempotentHint: true },
		},
		async ({ id }) => reply(line(await confirmPlan(db, groupId, id)))
	)

	server.registerTool(
		"delete_line",
		{
			title: "Delete a line",
			description: "Remove a line from the log. It is soft-deleted: kept for sync and audit, never shown again.",
			inputSchema: z.object({ id: idOf("line") }),
			annotations: REMOVES,
		},
		async ({ id }) => reply({ deleted: line(await deleteEntry(db, groupId, id)) })
	)
}
