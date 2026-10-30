import { api } from "../lib/api"
import { noteChange } from "../lib/changes"
import { clock } from "../lib/format"
import kv from "../lib/kv"
import { addEntry } from "./entries.web"

// Web twin of db/todos.js: same names, same signatures, same shapes. The `db`
// parameter is accepted and ignored; the server holds the rows. Every mutating
// call ends with noteChange().
//
// One assumption the server side must match (CONTRACT NOTE): POST
// /todos/:id/close and /reopen change only the todo's state — the record lines
// (`done: …`, `started: …`) are written here through POST /lines, exactly as
// the native sibling writes them in this layer, so nothing is written twice.

// Every open todo, with what the screen shows beside it: days_late, planned_*,
// spent_ms, started_ts — the server computes them with its own clock, so the
// `today` the native signature carries is accepted and ignored.
export async function openTodos(_db, _today) {
	const active = await activeTodoId()
	const query = new URLSearchParams({ status: "open" })
	if (active !== null) query.set("active", active)
	const data = await api(`/api/v1/todos?${query}`)
	return data.todos
}

// Done and trashed, newest first.
export async function closedTodos(_db) {
	const data = await api("/api/v1/todos?status=closed")
	return data.todos
}

// `dueOn` null = the queue.
export async function addTodo(_db, { text, dueOn }) {
	const data = await api("/api/v1/todos", { method: "POST", body: { text, dueOn } })
	noteChange()
	return data.todo
}

// The ONE place `due_on` changes: pulling from the queue onto a day, or pushing back.
export async function setDueOn(_db, id, dueOn) {
	await api(`/api/v1/todos/${id}/due`, { method: "POST", body: { dueOn } })
	noteChange()
}

// Done or trashed. The day still reads as a true record: an ordinary log line
// is written for it, marked `source: todo`. Returns that line's id, for undo.
export async function closeTodo(db, todo, status, today) {
	await api(`/api/v1/todos/${todo.id}/close`, { method: "POST", body: { status } })
	if ((await activeTodoId()) === todo.id) await setActiveTodo(null)
	const lineId = await todoLine(db, today, `${status}: ${todo.text}`)
	noteChange()
	return lineId
}

// Undo for closeTodo: open again, and the line it wrote taken back — it did not happen.
export async function reopenTodo(_db, todoId, lineId) {
	// The server reopens the todo and takes the closing line back (a soft
	// delete) in one call — the line id says which line that is.
	await api(`/api/v1/todos/${todoId}/reopen`, { method: "POST", body: { lineId } })
	noteChange()
}

// A line the app writes on a todo's behalf — `21:14 done: write report`,
// `9:05 started: anki deck` — marked `source: todo` so it is drawn as the
// todo's own row, struck or not, and never mistaken for something typed.
async function todoLine(db, day, body) {
	const now = Date.now()
	return addEntry(db, { day, text: `${clock(now)} ${body}`, source: "todo" })
}

// Scheduling is an ordinary `plan` line linked back to the todo. CONTRACT NOTE:
// the contract's body is `{ text }` alone, but the text carries no date — the
// day the block belongs on travels with it and the server needs one of the two.
export async function scheduleTodo(_db, todo, { day, text }) {
	await api(`/api/v1/todos/${todo.id}/schedule`, { method: "POST", body: { text, day } })
	noteChange()
}

// The lines that time spent is summed over, oldest first.
export async function linkedEntries(_db, todoId) {
	const data = await api(`/api/v1/todos/${todoId}/links`)
	return data.entries
}

// ------------------------------------------------------------ time attaches itself

// The todo being worked on right now — a person's choice, kept in kv exactly
// where the native sibling keeps it, so a `/timer` started from the log knows
// where its time belongs. Null when none.
const ACTIVE_TODO_KEY = "active-todo"

export function activeTodoId() {
	return kv.getItemAsync(ACTIVE_TODO_KEY)
}

export function setActiveTodo(id) {
	if (id === null) return kv.removeItemAsync(ACTIVE_TODO_KEY)
	return kv.setItemAsync(ACTIVE_TODO_KEY, id)
}

// Called by the native `startTimer` with the new timer row. On web the timer
// endpoint takes `todoId` itself (see timers.web.js), so there is nothing to
// link here.
export function linkTimerToActiveTodo(_db, _entryId, _now) {
	return Promise.resolve()
}

// Log ranges whose text fuzzy-matches the todo, best match first — proposed
// only, nothing here writes.
export async function proposedLinks(_db, todo) {
	const data = await api(`/api/v1/todos/${todo.id}/proposals`)
	return data.proposals
}

// Answering a proposal. `confirmed` = yes: the line's time counts from now on.
// No: a remembered "not this" — the same line is never proposed again.
export async function answerProposal(_db, todoId, entryId, confirmed) {
	await api(`/api/v1/todos/${todoId}/proposals/${entryId}`, { method: "POST", body: { accept: confirmed } })
	noteChange()
}

// ------------------------------------------------------------ said in so many words

// Open todos as the intent matcher wants them: id and text.
export async function openTodosBrief(db) {
	const todos = await openTodos(db)
	return todos.map((todo) => ({ id: todo.id, text: todo.text }))
}

// Act on what a line said about a todo (todoIntent in @dotbook/core/parse).
// `todos` is the list the intent's `index` points into; `entryId` is the line
// that said it, when there is one — already written, so only the todo's state
// changes here. CONTRACT NOTE: the started/finished link itself is the
// server's to make from its own reading of the line, as it does for any write.
export async function applyTodoIntent(db, intent, todos, { day, entryId = null }) {
	let todo = todos[intent.index] ?? null
	if (intent.action === "start" && todo === null) {
		// `/todo starting reply to landlord` with nothing open by that name: it is new.
		todo = await addTodo(db, { text: intent.rest, dueOn: day })
	}
	if (intent.action === "start") {
		await setActiveTodo(todo.id)
		// The server links the typed line, or — from `/todo starting …`, with no
		// line yet — writes the `started:` line itself: when time on it begins.
		await api(`/api/v1/todos/${todo.id}/start`, { method: "POST", body: { lineId: entryId } })
		noteChange()
		return todo
	}
	if (intent.action === "later") {
		await setDueOn(db, todo.id, intent.dueOn)
		return todo
	}
	// done / trash: closed without a second line — the one that said it stands
	// for the record, struck (see DoneLine), and carries the time. The line id
	// rides along so the server can link it instead of writing its own.
	const status = intent.action === "done" ? "done" : "trashed"
	await api(`/api/v1/todos/${todo.id}/close`, { method: "POST", body: { status, lineId: entryId } })
	if ((await activeTodoId()) === todo.id) await setActiveTodo(null)
	// `/todo … done` said it without a line of its own: write the record line.
	if (entryId === null) await todoLine(db, day, `${status}: ${todo.text}`)
	noteChange()
	return todo
}

// ------------------------------------------------------------------ in the log

// The open todos a day shows at the top of its log: due that day or earlier, so
// a late one keeps surfacing. The server filters with its own clock, so the
// `today` of the native signature is accepted and ignored.
export async function todosForDay(_db, day, _today) {
	const data = await api(`/api/v1/days/${encodeURIComponent(day)}/entries`)
	return data.todos
}

// The rows the Today list renders: open todos first (tagged `kind: "todo"` so
// the list can tell them from lines), then the day's lines as they are.
export function mergeTodosIntoLog(entries, todos) {
	if (todos.length === 0) return entries
	return [...todos.map((todo) => ({ ...todo, kind: "todo" })), ...entries]
}
