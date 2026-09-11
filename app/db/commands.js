import { parseCommand, parseLineTime, parseTodo, todoIntent } from "@dotbook/core/parse"
import { addEntry, stampedNow } from "./entries"
import { startTimer } from "./timers"
import { activeTodoId, addTodo, applyTodoIntent, openTodosBrief } from "./todos"

// What `/` offers, and what each command does when the line is submitted.
// The grammar lives in @dotbook/core/parse (commands.js, todo.js, todoIntent.js);
// this file only turns a parsed line into writes.
export const COMMANDS = [
	{ name: "timer", hint: "minutes, or take the suggestion" },
	{ name: "todo", hint: "add, or: starting / done / drop / later <task>" },
	{ name: "plan", hint: "a block: 12:00 -> 12:30 Praxology" },
]

/**
 * Run the line. Returns true when it was a command and was handled, or an
 * ordinary line that said something about a todo ("anki deck done") and was
 * written and acted on here. False: an ordinary line, the caller's to write.
 * @param {string} day  the day being viewed, YYYY-MM-DD
 */
export async function runCommand(db, day, line) {
	const command = parseCommand(line, day)
	if (!command) return lineAboutTodo(db, day, line)
	if (command.rest === "") return false

	if (command.name === "timer") {
		const minutes = Number(command.rest)
		if (!Number.isInteger(minutes) || minutes <= 0) return false
		await startTimer(db, { minutes, text: line })
		return true
	}
	if (command.name === "todo") {
		return todoCommand(db, day, command.rest)
	}
	if (command.name === "plan") {
		// The block is the line; the command word is not part of it.
		await addEntry(db, { day, text: command.rest, kind: "plan" })
		return true
	}
	return false
}

// `/todo …`: first what it says about an existing todo — starting, done, drop,
// later, or a bare date on an open one — then, failing that, a new todo.
async function todoCommand(db, day, rest) {
	const todos = await openTodosBrief(db)
	const intent = todoIntent(rest, await texts(todos), { activeIndex: await activeIndex(todos), day, bareDates: true })
	if (intent) {
		await applyTodoIntent(db, intent, todos, { day })
		return true
	}
	const { text, dueOn } = parseTodo(rest, { day })
	if (text === "") return false
	await addTodo(db, { text, dueOn })
	return true
}

// An ordinary line whose words are about an open todo: written as the line it
// is (stamped like any other), then the todo is started, finished, dropped or
// pushed, and the line is linked to it. Only a match counts — a line cannot
// create a todo by itself ("starting to feel tired" is not a task), that takes
// `/todo starting …`. Bare dates never count here: "dentist tomorrow" is a note.
async function lineAboutTodo(db, day, line) {
	if (line.startsWith("/")) return false
	const todos = await openTodosBrief(db)
	if (todos.length === 0) return false
	const { body } = parseLineTime(line, day)
	const intent = todoIntent(body, await texts(todos), { activeIndex: await activeIndex(todos), day })
	if (!intent || intent.index === -1) return false

	const stamped = stampedNow(line, day)
	const entryId = await addEntry(db, { day, ...stamped })
	await applyTodoIntent(db, intent, todos, { day, entryId })
	return true
}

function texts(todos) {
	return todos.map((todo) => todo.text)
}

// Where the todo being worked on sits in `todos`, or -1.
async function activeIndex(todos) {
	const id = await activeTodoId()
	return id === null ? -1 : todos.findIndex((todo) => todo.id === id)
}
