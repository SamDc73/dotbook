// Todos: list, add, close (done / trashed), start, move, schedule.

import { parseTodo } from "@dotbook/core/parse"
import * as z from "zod/v4"
import { addTodo, closedTodos, closeTodo, openTodos, scheduleTodo, setDueOn, startTodo } from "../../db/todos.js"
import { today } from "../../wallClock.js"
import { DAY, idOf, OPTIONAL_DAY, READ_ONLY, WRITES } from "../fields.js"
import { line, reply, todo } from "../reply.js"

const CLOSED = { done: ["done"], trashed: ["trashed"], all: ["done", "trashed"] }

// A todo's date: a day, or `later` for the queue (no date).
const DUE = z.union([DAY, z.literal("later")])

export function registerTodoTools(server, { db, groupId, canWrite }) {
	server.registerTool(
		"list_todos",
		{
			title: "List todos",
			description:
				"Open todos (the default): dated ones by date with `daysLate` when overdue, then the queue (no date). " +
				"`planned` is the plan block scheduled for it. Or closed ones: done, trashed, or both.",
			inputSchema: z.object({
				status: z.enum(["open", "done", "trashed", "all"]).optional().describe("Which todos; `open` when left out"),
			}),
			annotations: READ_ONLY,
		},
		async ({ status = "open" }) => {
			const open = status === "open" || status === "all" ? await openTodos(db, today()) : []
			const closed = status === "open" ? [] : await closedTodos(db, CLOSED[status])
			return reply({ today: today(), todos: [...open, ...closed].map(todo) })
		}
	)

	if (!canWrite) return

	server.registerTool(
		"add_todo",
		{
			title: "Add a todo",
			description:
				"Add a todo. Without `due`, a date phrase at the end of the text sets it the way the app's `/todo` does " +
				"(`book dentist tmr`, `call mum fri`, `read tabs later` for the queue), else it is due today.",
			inputSchema: z.object({
				text: z.string().min(1).describe("What to do"),
				due: DUE.optional().describe("YYYY-MM-DD, or `later` for the queue (no date)"),
			}),
			annotations: WRITES,
		},
		async ({ text, due }) => {
			const parsed = due === undefined ? parseTodo(text, { day: today() }) : { text, dueOn: dueOn(due) }
			return reply(todo(await addTodo(db, groupId, parsed)))
		}
	)

	server.registerTool(
		"close_todo",
		{
			title: "Close a todo",
			description:
				"Mark a todo done, or trash it (dropped, not doing it). Writes the record line into today's log " +
				"(`9:14 pm done: …`), as the app does.",
			inputSchema: z.object({
				id: idOf("todo"),
				status: z.enum(["done", "trashed"]).describe("`done`, or `trashed` when dropped"),
			}),
			annotations: WRITES,
		},
		async ({ id, status }) => {
			const closed = await closeTodo(db, groupId, id, status)
			return reply({ todo: todo(closed.todo), line: line(closed.line) })
		}
	)

	server.registerTool(
		"start_todo",
		{
			title: "Start a todo",
			description: "Note that work on a todo starts now: writes `started: …` into today's log, linked to it.",
			inputSchema: z.object({ id: idOf("todo") }),
			annotations: WRITES,
		},
		async ({ id }) => {
			const started = await startTodo(db, groupId, id)
			return reply({ todo: todo(started.todo), line: line(started.line) })
		}
	)

	server.registerTool(
		"set_todo_due",
		{
			title: "Move a todo",
			description: "Give an open todo a new date, or send it back to the queue with `later`.",
			inputSchema: z.object({ id: idOf("todo"), due: DUE.describe("YYYY-MM-DD, or `later` for the queue") }),
			annotations: { ...WRITES, idempotentHint: true },
		},
		async ({ id, due }) => reply(todo(await setDueOn(db, groupId, id, dueOn(due))))
	)

	server.registerTool(
		"schedule_todo",
		{
			title: "Schedule a todo",
			description:
				"Give a todo a time block: writes a plan line (e.g. `2:00 pm -> 3:00 pm write report`) linked to it. " +
				"Scheduling again replaces the previous block.",
			inputSchema: z.object({
				id: idOf("todo"),
				text: z.string().min(1).describe("The block as a line: a time range, then the text"),
				day: OPTIONAL_DAY,
			}),
			annotations: WRITES,
		},
		async ({ id, text, day }) => {
			const scheduled = await scheduleTodo(db, groupId, id, { day: day ?? today(), text })
			return reply({ todo: todo(scheduled.todo), line: line(scheduled.line) })
		}
	)
}

function dueOn(due) {
	return due === "later" ? null : due
}
