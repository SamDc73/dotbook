// `/` commands, and the one natural form the log understands.
//
// A command lives at column 0 and nowhere else: `/timer 25`, `/todo book
// dentist tmr`, `/plan 12:00 -> 12:30 Praxology`. Mid-line a slash is a slash.
// `plan` also works as a word — `plan: 12:00 lunch` always, and `plan 12:00
// lunch` when a time follows — because that is how a person would say it.

import { parseLineTime } from "./time.js"

// `/name` then the rest of the line. The name is letters only.
const SLASH = /^\/([a-z]+)\b\s*(.*)$/i

// `plan:` or `plan ` at the start of a line.
const PLAN_WORD = /^plan(:|\s+)(.*)$/i

/**
 * @param {string} line  the whole line as typed
 * @param {string} [day]  YYYY-MM-DD — only needed to judge whether `plan …` carries a time
 * @returns {{ name: string, rest: string } | null}
 *   `name` is lower-case; `rest` is the line after the command, trimmed.
 */
export function parseCommand(line, day = "2000-01-01") {
	const slash = SLASH.exec(line.trim())
	if (slash) {
		return { name: slash[1].toLowerCase(), rest: slash[2].trim() }
	}
	const plan = PLAN_WORD.exec(line.trim())
	if (!plan) {
		return null
	}
	const rest = plan[2].trim()
	// `plan: anything` is a plan. `plan the week` is a log line about planning;
	// `plan 12:00 lunch` is a plan — the time is what tells them apart.
	if (plan[1] === ":" || parseLineTime(rest, day).timeText !== "") {
		return { name: "plan", rest }
	}
	return null
}
