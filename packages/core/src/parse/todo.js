// `/todo` grammar: the text, then — at the end — when.
//
//   /todo book dentist tmr        → "book dentist", tomorrow
//   /todo call mum fri            → "call mum", this Friday
//   /todo pay rent 12 oct         → "pay rent", 12 October
//   /todo reply to Sam in 3 days  → "reply to Sam", three days on
//   /todo read old tabs queue     → "read old tabs", no date (the queue)
//   /todo buy milk                → "buy milk", today — it was typed on the day
//
// chrono-node reads the date phrase (it already handles `tmr`, weekdays,
// `next mon`, `12 oct`, `in 3 days`); this file only insists that the phrase
// is the tail of the text, so a number inside the todo (`buy 3 eggs`) is not
// mistaken for a date. No todo library: the grammar is these thirty lines.

import * as chrono from "chrono-node"
import { localDay } from "./natural.js"

// The last word that means "no date, keep it in the queue".
const QUEUE_WORD = /\s+(queue|later)$/i

/**
 * @param {string} text  what followed `/todo`
 * @param {{ day: string, now?: number }} options  the day it was typed on, and the clock
 * @returns {{ text: string, dueOn: string | null, when: string }}
 *   `when` is the phrase that set the date ("" when none), for the caller to show or test.
 */
export function parseTodo(text, { day, now = Date.now() }) {
	const trimmed = text.trim()

	const queue = QUEUE_WORD.exec(trimmed)
	if (queue) {
		return { text: trimmed.slice(0, queue.index).trim(), dueOn: null, when: queue[1] }
	}

	const phrase = trailingDate(trimmed, day, now)
	if (phrase) {
		return { text: trimmed.slice(0, phrase.index).trim(), dueOn: phrase.day, when: phrase.text }
	}
	return { text: trimmed, dueOn: day, when: "" }
}

// A date phrase chrono finds that runs to the end of the text, with some
// text before it — the todo itself.
function trailingDate(text, day, now) {
	const results = chrono.casual.parse(text, referenceOn(day, now), { forwardDate: true })
	const last = results.at(-1)
	if (!last || last.index === 0 || last.index + last.text.length !== text.length) {
		return null
	}
	return { index: last.index, text: last.text, day: localDay(last.start.date().getTime()) }
}

// Same convention as natural.js: the clock of `now` on the calendar date `day`.
function referenceOn(day, now) {
	const [year, month, date] = day.split("-").map(Number)
	const clock = new Date(now)
	return new Date(year, month - 1, date, clock.getHours(), clock.getMinutes())
}
