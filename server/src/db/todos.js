// Todos on the server — the MCP endpoint's half of what app/db/todos.js does on
// a device. `due_on` is written by a person (here, through their AI tool) and
// never by a job; carry-over is a view. Closing or starting a todo writes the
// same record line the app writes, linked the same way, so the log draws it as
// the todo's own row. Writes go through publish/publishUpdate so they sync.

import { uuidv7 } from "uuidv7"
import { publish, publishUpdate } from "../sync/publish.js"
import { stamped, today } from "../wallClock.js"
import { addEntry } from "./entries.js"

// What the log and the todo list show beside a todo: how late it is, the
// window of the newest live plan line scheduled for it, when it was last started.
const SHOWN = `t.*,
	CASE WHEN t.due_on < ? THEN CAST(julianday(?) - julianday(t.due_on) AS INTEGER) END AS days_late,
	p.day AS planned_day, p.ts_start AS planned_start, p.ts_end AS planned_end,
	(SELECT max(s.ts_start) FROM todo_links ls JOIN entries s ON s.id = ls.entry_id
		WHERE ls.todo_id = t.id AND ls.origin = 'started' AND s.deleted_at IS NULL) AS started_ts`
const PLANNED = `LEFT JOIN entries p ON p.id = (
	SELECT l.entry_id FROM todo_links l JOIN entries e ON e.id = l.entry_id
	WHERE l.todo_id = t.id AND l.origin = 'planned' AND e.deleted_at IS NULL
	ORDER BY l.confirmed_at DESC LIMIT 1)`

/** Open todos, dated ones first by date, the queue (no date) last. */
export function openTodos(db, day) {
	return db.all(
		`SELECT ${SHOWN} FROM todos t ${PLANNED}
		WHERE t.status = 'open' AND t.deleted_at IS NULL
		ORDER BY t.due_on IS NULL, t.due_on, t.created_at`,
		[day, day]
	)
}

/** Done and trashed, newest first. Trashed stays: what you repeatedly drop is information. */
export function closedTodos(db, statuses) {
	const marks = statuses.map(() => "?").join(", ")
	return db.all(
		`SELECT * FROM todos WHERE status IN (${marks}) AND deleted_at IS NULL ORDER BY closed_at DESC`,
		statuses
	)
}

/**
 * The open todos a day's log shows — app/db/todos.js `todosForDay`: today shows
 * everything due by today (late ones included), a day ahead only what is due
 * that day, a past day nothing (its closed todos stand there as their own lines).
 */
export function todosForDay(db, day, now = Date.now()) {
	const current = today(now)
	if (day < current) return Promise.resolve([])
	const from = day === current ? "0000-00-00" : day
	return db.all(
		`SELECT ${SHOWN} FROM todos t ${PLANNED}
		WHERE t.status = 'open' AND t.deleted_at IS NULL AND t.due_on >= ? AND t.due_on <= ?
		ORDER BY t.due_on, t.created_at`,
		[current, current, from, day]
	)
}

async function openTodo(db, id) {
	const todo = await db.get("SELECT * FROM todos WHERE id = ? AND deleted_at IS NULL", [id])
	if (!todo) {
		throw new Error(`No todo with id ${id} — list the todos again for current ids.`)
	}
	if (todo.status !== "open") {
		throw new Error(`"${todo.text}" is already ${todo.status}.`)
	}
	return todo
}

/** `dueOn` null = the queue. @returns the new row */
export async function addTodo(db, groupId, { text, dueOn }) {
	const row = {
		id: uuidv7(),
		text: text.trim(),
		due_on: dueOn,
		status: "open",
		closed_at: null,
		created_at: Date.now(),
		deleted_at: null,
	}
	if (row.text === "") {
		throw new Error("A todo needs some text.")
	}
	await publish(db, groupId, "todos", [row])
	return row
}

/** The one place `due_on` changes: onto a day, or back to the queue (null). */
export async function setDueOn(db, groupId, id, dueOn) {
	const todo = await openTodo(db, id)
	await publishUpdate(db, groupId, "todos", { id }, { due_on: dueOn })
	return { ...todo, due_on: dueOn }
}

/**
 * Done or trashed — app/db/todos.js `applyTodoIntent`: the todo closes, and the
 * day gets its record line (`9:14 pm done: write report`, `source: todo`),
 * linked as `finished` or `trashed`.
 */
export async function closeTodo(db, groupId, id, status, now = Date.now()) {
	const todo = await openTodo(db, id)
	await publishUpdate(db, groupId, "todos", { id }, { status, closed_at: now })
	const line = await todoLine(db, groupId, `${status}: ${todo.text}`, now)
	await link(db, groupId, id, line.id, status === "done" ? "finished" : "trashed", now)
	return { todo: { ...todo, status, closed_at: now }, line }
}

/**
 * Picking a todo up: `9:05 am started: anki deck`, linked as `started` — when
 * time on it begins. Which todo a device's timer counts toward is that device's
 * own setting (kv-store), so starting here does not change it.
 */
export async function startTodo(db, groupId, id, now = Date.now()) {
	const todo = await openTodo(db, id)
	const line = await todoLine(db, groupId, `started: ${todo.text}`, now)
	await link(db, groupId, id, line.id, "started", now)
	return { todo, line }
}

/**
 * Scheduling is an ordinary plan line linked back to the todo; the window is
 * read from the line, never copied. Rescheduling soft-deletes the previous plan
 * line — its link stays as history.
 */
export async function scheduleTodo(db, groupId, id, { day, text }, now = Date.now()) {
	const todo = await openTodo(db, id)
	const previous = await db.all(
		`SELECT l.entry_id FROM todo_links l JOIN entries e ON e.id = l.entry_id
		WHERE l.todo_id = ? AND l.origin = 'planned' AND e.deleted_at IS NULL`,
		[id]
	)
	for (const { entry_id: entryId } of previous) {
		await publishUpdate(db, groupId, "entries", { id: entryId }, { deleted_at: now })
	}
	const line = await addEntry(db, groupId, { day, text, kind: "plan" }, now)
	await link(db, groupId, id, line.id, "planned", now)
	return { todo, line }
}

// A line written on a todo's behalf, on today, marked `source: todo` so it is
// drawn as the todo's own row and never mistaken for something typed.
function todoLine(db, groupId, body, now) {
	return addEntry(db, groupId, { day: today(now), text: stamped(body, now), source: "todo" }, now)
}

// One link per (todo, line); a second one changes nothing.
async function link(db, groupId, todoId, entryId, origin, confirmedAt) {
	const exists = await db.get("SELECT 1 FROM todo_links WHERE todo_id = ? AND entry_id = ?", [todoId, entryId])
	if (exists) return
	await publish(db, groupId, "todo_links", [{ todo_id: todoId, entry_id: entryId, origin, confirmed_at: confirmedAt }])
}
