import { fuzzyFind } from "@dotbook/core/parse"
import { COMMANDS } from "../db/commands"

// What the `/` menu lists: the commands app/db/commands.js runs, filtered by
// what was typed after the slash, best first.
const NAMES = COMMANDS.map((command) => command.name)

export function matchCommands(query) {
	const { ranked } = fuzzyFind(query, NAMES)
	return ranked.map((index) => COMMANDS[index])
}
