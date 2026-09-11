import { uuidv7 } from "uuidv7"
import { addEntry } from "./entries"

// Todos: not lines. `due_on` is written once by a person and never by a job —
// carry-over is a view (see `openTodos`), so "how long have I been dodging this"
// stays answerable from the original date. See V0.1 → feature 17.

// Every open todo, with what the screen shows beside it:
//   days_late      whole days past `due_on`, null for the queue and for the future
//   planned_*      the linked `plan` line's day and window — only when one exists
//   spent_ms       time attributed through `timer` / `matched` links
export function openTodos(db, today) {
	return db.sql`SELECT t.*,
			CASE WHEN t.due_on < ${today}
				THEN CAST(julianday(${today}) - julianday(t.due_on) AS INTEGER)
			END AS days_late,
			p.day AS planned_day, p.ts_start AS planned_start, p.ts_end AS planned_end,
			(SELECT coalesce(sum(e.ts_end - e.ts_start), 0)
				FROM todo_links l JOIN entries e ON e.id = l.entry_id
				WHERE l.todo_id = t.id AND l.origin IN ('timer', 'matched')
					AND e.ts_start IS NOT NULL AND e.ts_end IS NOT NULL AND e.deleted_at IS NULL) AS spent_ms
		FROM todos t
		LEFT JOIN todo_links pl ON pl.todo_id = t.id AND pl.origin = 'planned'
		LEFT JOIN entries p ON p.id = pl.entry_id AND p.deleted_at IS NULL
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
	return db.sql`INSERT INTO todos (id, text, due_on, created_at)
		VALUES (${uuidv7()}, ${text.trim()}, ${dueOn}, ${Date.now()})`
}

// The ONE place `due_on` changes: pulling from the queue onto a day, or pushing
// back. A person's decision, never a nightly job — history does not move.
export function setDueOn(db, id, dueOn) {
	return db.sql`UPDATE todos SET due_on = ${dueOn} WHERE id = ${id}`
}

// Done or trashed. The day still reads as a true record: an ordinary log line
// is written for it, marked `source: todo`.
export async function closeTodo(db, todo, status, today) {
	const now = Date.now()
	await db.sql`UPDATE todos SET status = ${status}, closed_at = ${now} WHERE id = ${todo.id}`
	const id = await addLine(db, today, `${clock(now)} ${status}: ${todo.text}`)
	await db.sql`UPDATE entries SET source = 'todo' WHERE id = ${id}`
}

// Scheduling is an ordinary `plan` line linked back to the todo. The window is
// read from that line, never copied here, so moving the block moves the todo.
// One planned link per todo: rescheduling replaces the previous one.
export async function scheduleTodo(db, todo, { day, text }) {
	await db.sql`DELETE FROM todo_links WHERE todo_id = ${todo.id} AND origin = 'planned'`
	const id = await addLine(db, day, text)
	await db.sql`UPDATE entries SET kind = 'plan' WHERE id = ${id}`
	await db.sql`INSERT INTO todo_links (todo_id, entry_id, origin, confirmed_at)
		VALUES (${todo.id}, ${id}, 'planned', ${Date.now()})`
}

// The lines that time spent is summed over, oldest first.
export function linkedEntries(db, todoId) {
	return db.sql`SELECT e.*, l.origin FROM todo_links l JOIN entries e ON e.id = l.entry_id
		WHERE l.todo_id = ${todoId} AND l.origin IN ('timer', 'matched') AND e.deleted_at IS NULL
		ORDER BY e.ts_start`
}

// `addEntry` does not return the id it generated, and entries.js is not this
// module's to change. The line has a strict `H:MM` prefix, so it always lands on
// `day` with the highest seq — that is how it is found straight after.
async function addLine(db, day, text) {
	await addEntry(db, { day, text })
	const { id } = await db.sql`SELECT id FROM entries WHERE day = ${day} ORDER BY seq DESC LIMIT 1`.first()
	return id
}

// `H:MM`, 24-hour, the prefix the line parser reads back.
function clock(epochMs) {
	const at = new Date(epochMs)
	return `${at.getHours()}:${String(at.getMinutes()).padStart(2, "0")}`
}
