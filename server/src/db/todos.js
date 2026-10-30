// Todos on the server — the MCP endpoint's half of what app/db/todos.js does on
// a device. `due_on` is written by a person (here, through their AI tool) and
// never by a job; carry-over is a view. Closing or starting a todo writes the
// same record line the app writes, linked the same way, so the log draws it as
// the todo's own row. Writes go through publish/publishUpdate so they sync.

import { fuzzyFind, localDay, parseLineTime } from "@dotbook/core/parse"
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

/**
 * Open todos as the app's Todos screen reads them — app/db/todos.js `openTodos`,
 * the same SELECT word for word: `spent_ms` and the plan window included, because
 * the screen draws them. (An AI tool's answer goes through `todo()` in mcp/reply.js,
 * which picks the fields it wants, so the wider row costs it nothing.)
 *
 * Dated ones first by date, the queue (no date) last.
 */
export function openTodos(db, day) {
	return db.all(
		`SELECT t.*,
			CASE WHEN t.due_on < ? THEN CAST(julianday(?) - julianday(t.due_on) AS INTEGER) END AS days_late,
			p.day AS planned_day, p.ts_start AS planned_start, p.ts_end AS planned_end,
			(SELECT coalesce(sum(e.ts_end - e.ts_start), 0)
				FROM todo_links l JOIN entries e ON e.id = l.entry_id
				WHERE l.todo_id = t.id AND l.origin IN ('timer', 'matched') AND l.confirmed_at IS NOT NULL
					AND e.ts_start IS NOT NULL AND e.ts_end IS NOT NULL AND e.deleted_at IS NULL)
			+ coalesce((SELECT f.ts_start - s.ts_start
				FROM todo_links lf JOIN entries f ON f.id = lf.entry_id
				JOIN todo_links ls ON ls.todo_id = lf.todo_id JOIN entries s ON s.id = ls.entry_id
				WHERE lf.todo_id = t.id AND lf.origin = 'finished' AND ls.origin = 'started'
					AND f.day = s.day AND f.ts_start > s.ts_start AND f.deleted_at IS NULL AND s.deleted_at IS NULL
				ORDER BY f.ts_start DESC LIMIT 1), 0) AS spent_ms,
			(SELECT max(s.ts_start) FROM todo_links ls JOIN entries s ON s.id = ls.entry_id
				WHERE ls.todo_id = t.id AND ls.origin = 'started' AND s.deleted_at IS NULL) AS started_ts
		FROM todos t
		LEFT JOIN entries p ON p.id = (
			SELECT l.entry_id FROM todo_links l JOIN entries e ON e.id = l.entry_id
			WHERE l.todo_id = t.id AND l.origin = 'planned' AND e.deleted_at IS NULL
			ORDER BY l.confirmed_at DESC LIMIT 1)
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
export async function startTodo(db, groupId, id, now = Date.now(), lineId = null) {
	const todo = await openTodo(db, id)
	// A typed "started …" line is the record already — link it, write no second one.
	const line = lineId ? { id: lineId } : await todoLine(db, groupId, `started: ${todo.text}`, now)
	await link(db, groupId, id, line.id, "started", now)
	return { todo, line }
}

/**
 * Scheduling is an ordinary plan line linked back to the todo; the window is
 * read from the line, never copied. Rescheduling soft-deletes the previous plan
 * line — its link stays as history. As in the app, the plan line gets a
 * reminder, so the todo rings at its start on the person's devices.
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
	await publish(db, groupId, "reminders", [
		{
			id: uuidv7(),
			template_id: null,
			entry_id: line.id,
			at: null,
			escalation_min: null,
			style: "notify",
			created_at: now,
			deleted_at: null,
		},
	])
	return { todo, line }
}

// A line written on a todo's behalf, on today, marked `source: todo` so it is
// drawn as the todo's own row and never mistaken for something typed.
function todoLine(db, groupId, body, now) {
	return addEntry(db, groupId, { day: today(now), text: stamped(body, now), source: "todo" }, now)
}

/**
 * Undo for `closeTodo` (app/db/todos.js `reopenTodo`): the todo is open again,
 * and the record line it wrote is taken back — it did not happen. With no
 * `lineId`, the newest `finished`/`trashed` link is the line to retract.
 */
export async function reopenTodo(db, groupId, id, lineId = null, now = Date.now()) {
	const todo = await db.get("SELECT * FROM todos WHERE id = ? AND deleted_at IS NULL", [id])
	if (!todo) {
		throw new Error(`No todo with id ${id} — list the todos again for current ids.`)
	}
	await publishUpdate(db, groupId, "todos", { id }, { status: "open", closed_at: null })
	const closing = lineId ?? (await closingLine(db, id))
	if (closing) {
		await publishUpdate(db, groupId, "entries", { id: closing }, { deleted_at: now })
	}
	return { ...todo, status: "open", closed_at: null }
}

/** The line a close wrote: the newest confirmed `finished`/`trashed` link, or null. */
async function closingLine(db, todoId) {
	const row = await db.get(
		`SELECT entry_id FROM todo_links WHERE todo_id = ? AND origin IN ('finished', 'trashed')
		AND confirmed_at IS NOT NULL ORDER BY confirmed_at DESC LIMIT 1`,
		[todoId]
	)
	return row?.entry_id ?? null
}

/**
 * The lines that time spent is summed over — app/db/todos.js `linkedEntries`,
 * the same SELECT word for word: confirmed `timer`/`matched` links, oldest first.
 */
export function linkedEntries(db, todoId) {
	return db.all(
		`SELECT e.*, l.origin FROM todo_links l JOIN entries e ON e.id = l.entry_id
		WHERE l.todo_id = ? AND l.origin IN ('timer', 'matched') AND l.confirmed_at IS NOT NULL
			AND e.deleted_at IS NULL
		ORDER BY e.ts_start`,
		[todoId]
	)
}

/**
 * Log ranges since the todo was written whose text fuzzy-matches it, best match
 * first — app/db/todos.js `proposedLinks`. Proposed only: nothing here writes,
 * and a line already answered for this todo is never proposed again.
 */
export async function proposedLinks(db, todo) {
	const since = localDay(todo.created_at)
	const candidates = await db.all(
		`SELECT e.* FROM entries e
		WHERE e.kind = 'log' AND e.deleted_at IS NULL AND e.day >= ?
			AND e.ts_start IS NOT NULL AND e.ts_end IS NOT NULL
			AND e.id NOT IN (SELECT entry_id FROM todo_links WHERE todo_id = ?)
		ORDER BY e.ts_start DESC LIMIT 200`,
		[since, todo.id]
	)
	const bodies = candidates.map((entry) => parseLineTime(entry.text, entry.day).body)
	return fuzzyFind(todo.text, bodies).ranked.map((index) => candidates[index])
}

/**
 * Answering a proposal — app/db/todos.js `answerProposal`. Yes: the line's time
 * counts from now on. No: the link stays with `confirmed_at` null, a remembered
 * "not this", so the same line is never proposed again.
 */
export async function answerProposal(db, groupId, todoId, entryId, confirmed, now = Date.now()) {
	await link(db, groupId, todoId, entryId, "matched", confirmed ? now : null)
}

// One link per (todo, line); a second one changes nothing.
async function link(db, groupId, todoId, entryId, origin, confirmedAt) {
	const exists = await db.get("SELECT 1 FROM todo_links WHERE todo_id = ? AND entry_id = ?", [todoId, entryId])
	if (exists) return
	await publish(db, groupId, "todo_links", [{ todo_id: todoId, entry_id: entryId, origin, confirmed_at: confirmedAt }])
}
