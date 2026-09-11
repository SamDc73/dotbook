import { parseCommand, parseTodo } from "@dotbook/core/parse"
import { addEntry } from "./entries"
import { startTimer } from "./timers"
import { addTodo } from "./todos"

// What `/` offers, and what each command does when the line is submitted.
// The grammar lives in @dotbook/core/parse (commands.js, todo.js); this file
// only turns a parsed command into a write.
export const COMMANDS = [
	{ name: "timer", hint: "minutes, or take the suggestion" },
	{ name: "todo", hint: "what, then when: tmr · fri · 12 oct · queue" },
	{ name: "plan", hint: "a block: 12:00 -> 12:30 Praxology" },
]

/**
 * Run the line as a command. Returns true when it was one and it was handled;
 * false means "not a command, or nothing to do" and the line is ordinary.
 * @param {string} day  the day being viewed, YYYY-MM-DD
 */
export async function runCommand(db, day, line) {
	const command = parseCommand(line, day)
	if (!command || command.rest === "") return false

	if (command.name === "timer") {
		const minutes = Number(command.rest)
		if (!Number.isInteger(minutes) || minutes <= 0) return false
		await startTimer(db, { minutes, text: line })
		return true
	}
	if (command.name === "todo") {
		const { text, dueOn } = parseTodo(command.rest, { day })
		if (text === "") return false
		await addTodo(db, { text, dueOn })
		return true
	}
	if (command.name === "plan") {
		// The block is the line; the command word is not part of it.
		await addEntry(db, { day, text: command.rest, kind: "plan" })
		return true
	}
	return false
}
