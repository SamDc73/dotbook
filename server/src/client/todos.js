// Todos over HTTP for the web client — the routes the Todos screen calls. Runs
// after the bearer gate, so `auth` and `db` are set; `groupId` is the user's id.
//
// The work is server/src/db/todos.js, the same functions the MCP tools use, so a
// todo closed here writes the same record line the app writes. The "active todo"
// a timer attaches to is a device's own setting in the app (kv-store); on the
// server it is a query parameter, because a browser tab is not a device.

import { parseTodo } from "@dotbook/core/parse"
import {
	addTodo,
	answerProposal,
	closedTodos,
	closeTodo,
	linkedEntries,
	openTodos,
	proposedLinks,
	reopenTodo,
	scheduleTodo,
	setDueOn,
	startTodo,
} from "../db/todos.js"
import { today } from "../wallClock.js"

const DAY = /^\d{4}-\d{2}-\d{2}$/
// `closed` is both, as the app's Closed section shows: what you finished and what
// you dropped. Trashed stays queryable on purpose.
const CLOSED = { closed: ["done", "trashed"], done: ["done"], trashed: ["trashed"] }

export function todos(app) {
	// `status=open` (the default) gives the open list; `closed` both closed kinds;
	// `done` or `trashed` one. `active` is the todo being worked on, if any.
	app.get("/api/v1/todos", async (c) => {
		const status = c.req.query("status") ?? "open"
		const active = c.req.query("active") || null
		const db = c.get("db")
		const rows = status === "open" ? await openTodos(db, today()) : await closedTodos(db, CLOSED[status] ?? [])
		return c.json({ todos: rows, active })
	})

	// A new todo, parsed the way `/todo` parses one: a trailing date phrase sets
	// the day (`book dentist tmr`, `read tabs later` for the queue), else today.
	app.post(
		"/api/v1/todos",
		handled(async (c) => {
			const { text, dueOn } = await body(c)
			if (typeof text !== "string" || text.trim() === "") {
				return c.json({ error: "expected { text, dueOn? }" }, 400)
			}
			if (dueOn !== undefined && dueOn !== null && !DAY.test(dueOn)) {
				return c.json({ error: "dueOn is YYYY-MM-DD, or null for the queue" }, 400)
			}
			const parsed = dueOn === undefined ? parseTodo(text, { day: today() }) : { text, dueOn }
			const todo = await addTodo(c.get("db"), c.get("auth").user.id, parsed)
			return c.json({ todo }, 201)
		})
	)

	// Done or trashed. The record line is written as the app writes it; the undo
	// (`reopen`) retracts it from the newest closing link.
	app.post(
		"/api/v1/todos/:id/close",
		handled(async (c) => {
			const { status } = await body(c)
			if (status !== "done" && status !== "trashed") {
				return c.json({ error: 'expected { status: "done" | "trashed" }' }, 400)
			}
			await closeTodo(c.get("db"), c.get("auth").user.id, c.req.param("id"), status)
			return c.body(null, 204)
		})
	)

	// Undo for a close: open again, and its record line taken back. `lineId` is
	// the line a close returned; without it the newest closing link is used.
	app.post(
		"/api/v1/todos/:id/reopen",
		handled(async (c) => {
			const { lineId } = await body(c)
			await reopenTodo(c.get("db"), c.get("auth").user.id, c.req.param("id"), lineId ?? null)
			return c.body(null, 204)
		})
	)

	app.post(
		"/api/v1/todos/:id/start",
		handled(async (c) => {
			const { lineId = null } = await c.req.json().catch(() => ({}))
			await startTodo(c.get("db"), c.get("auth").user.id, c.req.param("id"), Date.now(), lineId)
			return c.body(null, 204)
		})
	)

	// Onto a day, or back to the queue with `dueOn: null`.
	app.post(
		"/api/v1/todos/:id/due",
		handled(async (c) => {
			const { dueOn } = await body(c)
			if (dueOn !== null && !DAY.test(dueOn ?? "")) {
				return c.json({ error: "dueOn is YYYY-MM-DD, or null for the queue" }, 400)
			}
			await setDueOn(c.get("db"), c.get("auth").user.id, c.req.param("id"), dueOn)
			return c.body(null, 204)
		})
	)

	// A plan block for the todo: an ordinary plan line linked back to it.
	app.post(
		"/api/v1/todos/:id/schedule",
		handled(async (c) => {
			const { text, day } = await body(c)
			if (typeof text !== "string" || text.trim() === "") {
				return c.json({ error: "expected { text, day? }" }, 400)
			}
			if (day !== undefined && !DAY.test(day)) {
				return c.json({ error: "a day is YYYY-MM-DD" }, 400)
			}
			await scheduleTodo(c.get("db"), c.get("auth").user.id, c.req.param("id"), { day: day ?? today(), text })
			return c.body(null, 204)
		})
	)

	// The lines time spent on this todo is summed over.
	app.get(
		"/api/v1/todos/:id/links",
		handled(async (c) => c.json({ entries: await linkedEntries(c.get("db"), c.req.param("id")) }))
	)

	// Log ranges that look like this todo, best match first — proposed, not applied.
	app.get(
		"/api/v1/todos/:id/proposals",
		handled(async (c) => {
			const todo = await todoOr404(c)
			return c.json({ proposals: await proposedLinks(c.get("db"), todo) })
		})
	)

	// Answering one: yes counts the line's time, no remembers "not this" for good.
	app.post(
		"/api/v1/todos/:id/proposals/:entryId",
		handled(async (c) => {
			const { accept } = await body(c)
			if (typeof accept !== "boolean") {
				return c.json({ error: "expected { accept: true | false }" }, 400)
			}
			await answerProposal(c.get("db"), c.get("auth").user.id, c.req.param("id"), c.req.param("entryId"), accept)
			return c.body(null, 204)
		})
	)
}

async function todoOr404(c) {
	const todo = await c.get("db").get("SELECT * FROM todos WHERE id = ? AND deleted_at IS NULL", [c.req.param("id")])
	if (!todo) {
		throw new Error(`No todo with id ${c.req.param("id")} — list the todos again for current ids.`)
	}
	return todo
}

// A refusal from a db module is the client's to fix — a stale id, a todo already
// closed — so it answers 4xx with the module's own message. Anything else is a
// real fault and surfaces as a 500 rather than hiding behind a 400.
function handled(fn) {
	return async (c) => {
		try {
			return await fn(c)
		} catch (error) {
			const stale = error.message?.startsWith("No ")
			const closed = error.message?.startsWith('"')
			if (!stale && !closed) {
				throw error
			}
			return c.json({ error: error.message }, stale ? 404 : 409)
		}
	}
}

async function body(c) {
	try {
		return await c.req.json()
	} catch {
		return {}
	}
}
