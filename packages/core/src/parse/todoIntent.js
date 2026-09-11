// What a line says about a todo, in plain English: starting it, finishing it,
// dropping it, pushing it back.
//
//   starting the anki deck        → start   the open todo that matches "anki deck"
//   anki deck done                → done    same todo, referenced at the end
//   finished the deck             → done    "deck" alone is enough when only one matches
//   done                          → done    no reference: the todo being worked on
//   drop call grandma             → trash
//   physics set later fri         → later   due Friday; bare `later` is the queue
//   starting reply to Sam         → start   no match → create it and start it
//
// A lexicon, not a language model: English only, verbs looked up at the start
// or the end of the text, filler dropped, and the rest matched against the open
// todos with the one fuzzy matcher the app shares. Dates go through parseTodo
// (chrono-node). V0.1 says fuzzy matches are proposed, never applied silently;
// these verbs are the person saying it outright, so they are the one exception.

import { fuzzyFind } from "./fuzzy.js"
import { parseTodo } from "./todo.js"

// Verb phrases per action. Matched as whole words, case-insensitive.
const VERBS = {
	start: [
		"starting",
		"started",
		"start",
		"beginning",
		"began",
		"begin",
		"working on",
		"work on",
		"back to",
		"resuming",
		"resume",
		"picking up",
		"pick up",
	],
	done: [
		"done",
		"finished",
		"finishing",
		"finish",
		"completed",
		"complete",
		"did",
		"wrapped up",
		"wrap up",
		"closed",
		"knocked out",
		"checked off",
	],
	trash: [
		"dropping",
		"dropped",
		"drop",
		"skipping",
		"skipped",
		"skip",
		"cancelled",
		"cancel",
		"abandoning",
		"abandon",
		"give up on",
		"gave up on",
		"trash",
		"not doing",
		"won't do",
		"wont do",
	],
	later: ["later", "postponing", "postpone", "defer", "pushing", "push", "queue", "parking", "park", "not today"],
}

// Words that carry nothing: dropped from the start of the text before the verb
// is looked for, and from both ends of what remains.
const LEAD_FILLER = /^(?:now|finally|ok|okay|just|also|and|so|then|i|i'm|im|i've|ive)\s+/i
const REF_LEAD = /^(?:the|a|an|my|this|that|on|with|to|of|it|up|at)\s+/i
const REF_TRAIL = /\s+(?:now|today|finally|it|that|again|too|yet|already|to)$/i
const DASHES = /^[—–\-:,]+\s*|\s*[—–\-:,]+$/g
const ALONE = /^(?:it|that|this|up|on|now|to)$/i

/**
 * @param {string} text  the line's body, or what followed `/todo`
 * @param {string[]} openTodos  texts of the open todos, in any order
 * @param {{ activeIndex?: number, day?: string, now?: number, bareDates?: boolean }} [options]
 *   `activeIndex` — the todo being worked on, for a verb with no reference;
 *   `bareDates` — let a trailing date with no verb (`anki deck tmr`) mean
 *   "later" — only inside `/todo`; a diary line must never reschedule anything.
 * @returns {{ action: "start"|"done"|"trash"|"later", index: number, rest: string, dueOn: string|null, when: string } | null}
 *   `index` is the matching open todo, or -1 for `start` with a reference that
 *   matches nothing: create it, then start it. Null: no verb, or nothing to act on.
 */
export function todoIntent(text, openTodos, options = {}) {
	const { activeIndex = -1, day = "2000-01-01", now = Date.now(), bareDates = false } = options
	const cleaned = text
		.trim()
		.replace(/[✓✔]/g, " done ")
		.replace(/[.!,;:]+$/, "")
		.replace(/\s+/g, " ")
		.replace(LEAD_FILLER, "")
		.trim()
	if (cleaned === "") return null

	const found = findVerb(cleaned)
	if (!found) {
		return bareDates ? bareDateIntent(cleaned, openTodos, { day, now }) : null
	}

	// `later fri`, `push anki deck to fri`: the date, if any, sits at the end.
	const date = found.action === "later" ? parseTodo(found.rest, { day, now, bare: true }) : null
	const reference = trimReference(`${found.before} ${date ? date.text : found.rest}`)
	const index = reference === "" ? activeIndex : match(reference, openTodos)

	if (index === -1 && !(found.action === "start" && reference !== "")) return null
	return {
		action: found.action,
		index,
		rest: reference,
		dueOn: laterDue(found, date),
		when: date?.when ?? "",
	}
}

// The verb at the start of the text, else at its end — except "later" verbs,
// which may be followed by the date (`physics set later fri`), so those are
// found anywhere and what follows them is handed back as `rest`. Longer
// phrases first so `give up on` wins over `up`; whole words so `started` is
// not `start`.
function findVerb(text) {
	for (const [action, phrases] of Object.entries(VERBS)) {
		for (const phrase of [...phrases].sort((a, b) => b.length - a.length)) {
			const word = escapeRegex(phrase)
			const atStart = new RegExp(`^${word}\\b\\s*(.*)$`, "i").exec(text)
			if (atStart) return { action, before: "", rest: atStart[1] }
			const atEnd = new RegExp(`^(.*?)\\s*\\b${word}$`, "i").exec(text)
			if (atEnd) return { action, before: atEnd[1], rest: "" }
			if (action !== "later") continue
			const anywhere = new RegExp(`^(.*?)\\s*\\b${word}\\b\\s*(.*)$`, "i").exec(text)
			if (anywhere) return { action, before: anywhere[1], rest: anywhere[2] }
		}
	}
	return null
}

// `/todo anki deck tmr` when "anki deck" is open: push it, do not create a twin.
function bareDateIntent(text, openTodos, { day, now }) {
	const date = parseTodo(text, { day, now })
	if (date.when === "") return null
	const reference = trimReference(date.text)
	const index = match(reference, openTodos)
	if (index === -1) return null
	return { action: "later", index, rest: reference, dueOn: date.dueOn, when: date.when }
}

// Where a "later" lands: the date it names, else the queue. `not today` is tomorrow.
function laterDue(found, date) {
	if (found.action !== "later") return null
	if (date && date.when !== "") return date.dueOn
	return null
}

// Filler and dashes shaved off both ends; a filler word standing alone (`it`)
// is no reference at all.
function trimReference(text) {
	let reference = text.trim()
	let previous = ""
	while (reference !== previous) {
		previous = reference
		reference = reference.replace(DASHES, "").replace(REF_LEAD, "").replace(REF_TRAIL, "").trim()
	}
	return ALONE.test(reference) ? "" : reference
}

// The confidence rule: uFuzzy already wants every term of the reference in the
// todo, in order; on top of that one term must be three letters or more, so a
// stray `it` or `up` cannot pick a todo by itself.
function match(reference, openTodos) {
	if (reference === "" || openTodos.length === 0) return -1
	if (!reference.split(/\s+/).some((term) => term.length >= 3)) return -1
	// Out of order on purpose: "flat reply" should find "reply to Sam about the flat".
	return fuzzyFind(reference, openTodos, { outOfOrder: true }).index
}

function escapeRegex(phrase) {
	return phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
