import { fuzzyFind, localDay, parseLineTime } from "@dotbook/core/parse"
import Storage from "expo-sqlite/kv-store"
import { uuidv7 } from "uuidv7"
import { clock } from "../lib/format"
import { addEntry } from "./entries"
import { insertRow, updateRow } from "./sync"

// Todos: not lines. `due_on` is written once by a person and never by a job —
// carry-over is a view (see `openTodos`), so "how long have I been dodging this"
// stays answerable from the original date. See V0.1 → feature 17.
// Writes go through insertRow/updateRow (db/sync.js) so they sync.

// Every open todo, with what the screen shows beside it:
//   days_late      whole days past `due_on`, null for the queue and for the future
//   planned_*      the newest live `plan` line linked to it — only when one exists
//   spent_ms       time attributed through confirmed `timer` / `matched` links,
//                  plus a `started` line to a `finished` line on the same day
//   started_ts     when a "starting …" line last picked it up — "working on it"
export function openTodos(db, today) {
	return db.sql`SELECT t.*,
			CASE WHEN t.due_on < ${today}
				THEN CAST(julianday(${today}) - julianday(t.due_on) AS INTEGER)
			END AS days_late,
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
// is written for it, marked `source: todo`. Returns that line's id, for undo.
export async function closeTodo(db, todo, status, today) {
	const now = Date.now()
	await updateRow(db, "todos", { id: todo.id }, { status, closed_at: now })
	if ((await activeTodoId()) === todo.id) await setActiveTodo(null)
	return todoLine(db, today, `${status}: ${todo.text}`, now)
}

// Undo for closeTodo: open again, and the line it wrote taken back — it did not happen.
export async function reopenTodo(db, todoId, lineId) {
	await updateRow(db, "todos", { id: todoId }, { status: "open", closed_at: null })
	await updateRow(db, "entries", { id: lineId }, { deleted_at: Date.now() })
}

// A line the app writes on a todo's behalf — `21:14 done: write report`,
// `9:05 started: anki deck` — marked `source: todo` so it is drawn as the
// todo's own row, struck or not, and never mistaken for something typed.
async function todoLine(db, day, body, now) {
	const id = await addEntry(db, { day, text: `${clock(now)} ${body}` })
	await updateRow(db, "entries", { id }, { source: "todo" })
	return id
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

// ------------------------------------------------------------ said in so many words

// Open todos as the intent matcher wants them: id and text, one query.
export function openTodosBrief(db) {
	return db.sql`SELECT id, text FROM todos WHERE status = 'open' AND deleted_at IS NULL ORDER BY created_at`
}

// Act on what a line said about a todo (todoIntent in @dotbook/core/parse).
// `todos` is the list the intent's `index` points into; `entryId` is the line
// that said it, when there is one — it is linked to the todo with the role
// the words gave it (`started`, `finished`, `trashed`), confirmed at once.
// V0.1 wants fuzzy matches proposed, never applied; a person writing "anki
// deck done" has done the proposing, so these links are the one exception.
export async function applyTodoIntent(db, intent, todos, { day, entryId = null }) {
	const now = Date.now()
	let todo = todos[intent.index] ?? null
	if (intent.action === "start" && todo === null) {
		// `/todo starting reply to landlord` with nothing open by that name: it is new.
		const id = uuidv7()
		await insertRow(db, "todos", {
			id,
			text: intent.rest,
			due_on: day,
			status: "open",
			closed_at: null,
			created_at: now,
			deleted_at: null,
		})
		todo = { id, text: intent.rest }
	}
	if (intent.action === "start") {
		await setActiveTodo(todo.id)
		// From `/todo starting …` there is no line yet: write the moment down, the
		// way `closeTodo` does — it is when the time on this todo begins.
		const startLine = entryId ?? (await todoLine(db, day, `started: ${todo.text}`, now))
		await link(db, todo.id, startLine, "started", now)
		return todo
	}
	if (intent.action === "later") {
		await setDueOn(db, todo.id, intent.dueOn)
		return todo
	}
	// done / trash: closed without a second line — the one that said it stands
	// for the record, struck (see DoneLine), and carries the time.
	const status = intent.action === "done" ? "done" : "trashed"
	await updateRow(db, "todos", { id: todo.id }, { status, closed_at: now })
	if ((await activeTodoId()) === todo.id) await setActiveTodo(null)
	// `/todo … done` said it without a line of its own: write the record line.
	const closeLine = entryId ?? (await todoLine(db, day, `${status}: ${todo.text}`, now))
	await link(db, todo.id, closeLine, status === "done" ? "finished" : "trashed", now)
	return todo
}

// ------------------------------------------------------------------ in the log

// The open todos a day shows at the top of its log: due that day or earlier, so
// a late one keeps surfacing (V0.1: carry-over is a view). Only for today and
// days ahead — a past day's log shows what was done, and a closed todo already
// stands there as its own `done:` / `trashed:` line (see `closeTodo`), which is
// why nothing closed is queried here: one row per todo, never two.
export function todosForDay(db, day, today) {
	if (day < today) return Promise.resolve([])
	// Today shows everything due by today (late ones included); a day ahead
	// shows only what is due that day.
	const from = day === today ? "0000-00-00" : day
	return db.sql`SELECT t.*,
			CASE WHEN t.due_on < ${today}
				THEN CAST(julianday(${today}) - julianday(t.due_on) AS INTEGER)
			END AS days_late,
			p.ts_start AS planned_start, p.ts_end AS planned_end,
			(SELECT max(s.ts_start) FROM todo_links ls JOIN entries s ON s.id = ls.entry_id
				WHERE ls.todo_id = t.id AND ls.origin = 'started' AND s.deleted_at IS NULL) AS started_ts
		FROM todos t
		LEFT JOIN entries p ON p.id = (
			SELECT l.entry_id FROM todo_links l JOIN entries e ON e.id = l.entry_id
			WHERE l.todo_id = t.id AND l.origin = 'planned' AND e.deleted_at IS NULL
			ORDER BY l.confirmed_at DESC LIMIT 1)
		WHERE t.status = 'open' AND t.deleted_at IS NULL AND t.due_on >= ${from} AND t.due_on <= ${day}
		ORDER BY t.due_on, t.created_at`
}

// The rows the Today list renders: open todos first (tagged `kind: "todo"` so
// the list can tell them from lines), then the day's lines as they are.
export function mergeTodosIntoLog(entries, todos) {
	if (todos.length === 0) return entries
	return [...todos.map((todo) => ({ ...todo, kind: "todo" })), ...entries]
}
