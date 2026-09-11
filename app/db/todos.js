import { fuzzyFind, localDay, parseLineTime } from "@dotbook/core/parse"
import Storage from "expo-sqlite/kv-store"
import { uuidv7 } from "uuidv7"
import { addEntry } from "./entries"
import { insertRow, updateRow } from "./sync"

// Todos: not lines. `due_on` is written once by a person and never by a job —
// carry-over is a view (see `openTodos`), so "how long have I been dodging this"
// stays answerable from the original date. See V0.1 → feature 17.
// Writes go through insertRow/updateRow (db/sync.js) so they sync.

// Every open todo, with what the screen shows beside it:
//   days_late      whole days past `due_on`, null for the queue and for the future
//   planned_*      the newest live `plan` line linked to it — only when one exists
//   spent_ms       time attributed through confirmed `timer` / `matched` links
export function openTodos(db, today) {
	return db.sql`SELECT t.*,
			CASE WHEN t.due_on < ${today}
				THEN CAST(julianday(${today}) - julianday(t.due_on) AS INTEGER)
			END AS days_late,
			p.day AS planned_day, p.ts_start AS planned_start, p.ts_end AS planned_end,
			(SELECT coalesce(sum(e.ts_end - e.ts_start), 0)
				FROM todo_links l JOIN entries e ON e.id = l.entry_id
				WHERE l.todo_id = t.id AND l.origin IN ('timer', 'matched') AND l.confirmed_at IS NOT NULL
					AND e.ts_start IS NOT NULL AND e.ts_end IS NOT NULL AND e.deleted_at IS NULL) AS spent_ms
		FROM todos t
		LEFT JOIN entries p ON p.id = (
			SELECT l.entry_id FROM todo_links l JOIN entries e ON e.id = l.entry_id
			WHERE l.todo_id = t.id AND l.origin = 'planned' AND e.deleted_at IS NULL
			ORDER BY l.confirmed_at DESC LIMIT 1)
		WHERE t.status = 'open' AND t.deleted_at IS NULL
		ORDER BY t.due_on IS NULL, t.due_on, t.created_at`
}

// Done and trashed, newest first. Trashed stays queryable on purpose: what you
// repeatedly drop is real information about yourself.
export function closedTodos(db) {
	return db.sql`SELECT * FROM todos WHERE status IN ('done', 'trashed') AND deleted_at IS NULL
		ORDER BY closed_at DESC`
}

// `dueOn` null = the queue.
export function addTodo(db, { text, dueOn }) {
	return insertRow(db, "todos", {
		id: uuidv7(),
		text: text.trim(),
		due_on: dueOn,
		status: "open",
		closed_at: null,
		created_at: Date.now(),
		deleted_at: null,
	})
}

// The ONE place `due_on` changes: pulling from the queue onto a day, or pushing
// back. A person's decision, never a nightly job — history does not move.
export function setDueOn(db, id, dueOn) {
	return updateRow(db, "todos", { id }, { due_on: dueOn })
}

// Done or trashed. The day still reads as a true record: an ordinary log line
// is written for it, marked `source: todo`.
export async function closeTodo(db, todo, status, today) {
	const now = Date.now()
	await updateRow(db, "todos", { id: todo.id }, { status, closed_at: now })
	if ((await activeTodoId()) === todo.id) await setActiveTodo(null)
	const id = await addEntry(db, { day: today, text: `${clock(now)} ${status}: ${todo.text}` })
	await updateRow(db, "entries", { id }, { source: "todo" })
}

// Scheduling is an ordinary `plan` line linked back to the todo. The window is
// read from that line, never copied here, so moving the block moves the todo.
// Rescheduling soft-deletes the previous plan line; its link stays as history,
// and `openTodos` reads the newest live one.
export async function scheduleTodo(db, todo, { day, text }) {
	const previous = await db.sql`SELECT l.entry_id FROM todo_links l JOIN entries e ON e.id = l.entry_id
		WHERE l.todo_id = ${todo.id} AND l.origin = 'planned' AND e.deleted_at IS NULL`
	for (const { entry_id: entryId } of previous) {
		await updateRow(db, "entries", { id: entryId }, { deleted_at: Date.now() })
	}
	const id = await addEntry(db, { day, text })
	await updateRow(db, "entries", { id }, { kind: "plan" })
	await link(db, todo.id, id, "planned", Date.now())
}

// The lines that time spent is summed over, oldest first.
export function linkedEntries(db, todoId) {
	return db.sql`SELECT e.*, l.origin FROM todo_links l JOIN entries e ON e.id = l.entry_id
		WHERE l.todo_id = ${todoId} AND l.origin IN ('timer', 'matched') AND l.confirmed_at IS NOT NULL
			AND e.deleted_at IS NULL
		ORDER BY e.ts_start`
}

// ------------------------------------------------------------ time attaches itself

// The todo being worked on right now — a person's choice, kept in kv-store so a
// `/timer` started from the log knows where its time belongs. Null when none.
const ACTIVE_TODO_KEY = "active-todo"

export function activeTodoId() {
	return Storage.getItemAsync(ACTIVE_TODO_KEY)
}

export function setActiveTodo(id) {
	if (id === null) return Storage.removeItemAsync(ACTIVE_TODO_KEY)
	return Storage.setItemAsync(ACTIVE_TODO_KEY, id)
}

// Called by `startTimer` with the new timer row: one tap, no thought. The link
// is confirmed at once because starting a timer while working on a todo is the
// person saying so. Nothing happens when no todo is active or it was closed.
export async function linkTimerToActiveTodo(db, entryId, now) {
	const todoId = await activeTodoId()
	if (todoId === null) return
	const open = await db.sql`SELECT 1 FROM todos WHERE id = ${todoId} AND status = 'open' AND deleted_at IS NULL`.first()
	if (!open) return
	await link(db, todoId, entryId, "timer", now)
}

// Log ranges since the todo was written whose text fuzzy-matches it, best match
// first. Proposed only — nothing here writes. A line already linked to this todo
// (confirmed or refused) is never proposed again.
export async function proposedLinks(db, todo) {
	const since = localDay(todo.created_at)
	const candidates = await db.sql`SELECT e.* FROM entries e
		WHERE e.kind = 'log' AND e.deleted_at IS NULL AND e.day >= ${since}
			AND e.ts_start IS NOT NULL AND e.ts_end IS NOT NULL
			AND e.id NOT IN (SELECT entry_id FROM todo_links WHERE todo_id = ${todo.id})
		ORDER BY e.ts_start DESC LIMIT 200`
	const bodies = candidates.map((entry) => parseLineTime(entry.text, entry.day).body)
	return fuzzyFind(todo.text, bodies).ranked.map((index) => candidates[index])
}

// Answering a proposal. `confirmed` = yes: the line's time counts from now on.
// No: the link is kept with `confirmed_at` null, so it is a remembered "not
// this" and the same line is never proposed again — the promotion prompt's rule.
export function answerProposal(db, todoId, entryId, confirmed) {
	return link(db, todoId, entryId, "matched", confirmed ? Date.now() : null)
}

// One link per (todo, entry); a second answer to the same line changes nothing.
async function link(db, todoId, entryId, origin, confirmedAt) {
	const exists = await db.sql`SELECT 1 FROM todo_links WHERE todo_id = ${todoId} AND entry_id = ${entryId}`.first()
	if (exists) return
	await insertRow(db, "todo_links", { todo_id: todoId, entry_id: entryId, origin, confirmed_at: confirmedAt })
}

// `H:MM`, 24-hour, the prefix the line parser reads back.
function clock(epochMs) {
	const at = new Date(epochMs)
	return `${at.getHours()}:${String(at.getMinutes()).padStart(2, "0")}`
}
