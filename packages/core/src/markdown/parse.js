// Reads the file render.js writes, and anything hand-written in the same
// shape. Lenient: a line that fits no pattern is skipped, never an error.
import { TZDate } from "@date-fns/tz"

const DAY = /^\d{4}-\d{2}-\d{2}$/
const TODO = /^- \[( |x|-)\] (.*)$/
const DATED = /^(.*) · (\d{4}-\d{2}-\d{2})$/
const HABIT = /^- (.*) · (do|avoid)$/
const TICK = /^ {2}- (\d{4}-\d{2}-\d{2}) · (kept|broken)$/
const WALL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/
const STATUS = { " ": "open", x: "done", "-": "trashed" }

/**
 * @param {string} text
 * @returns {import("./index.js").Export}
 */
export function parseMarkdown(text) {
	const data = { days: [], todos: [], habits: [], templates: [], recurrences: [] }
	let section = null
	let day = null
	let habit = null
	let version = null

	for (const raw of text.split(/\r?\n/)) {
		const line = raw.replace(/\s+$/, "")
		if (line.startsWith("## ")) {
			const title = line.slice(3).trim()
			day = null
			habit = null
			version = null
			if (DAY.test(title)) {
				section = "day"
				day = { day: title, lines: [] }
				data.days.push(day)
			} else {
				section = title.toLowerCase()
			}
			continue
		}
		if (section === "day") {
			if (line.startsWith("- [ ] ")) day.lines.push({ text: line.slice(6), kind: "plan" })
			else if (line.startsWith("- ")) day.lines.push({ text: line.slice(2), kind: "log" })
		} else if (section === "todos") {
			const todo = parseTodo(line)
			if (todo) data.todos.push(todo)
		} else if (section === "habits") {
			const head = line.match(HABIT)
			const tick = line.match(TICK)
			if (head) {
				habit = { name: head[1], kind: head[2], ticks: [] }
				data.habits.push(habit)
			} else if (tick && habit) {
				habit.ticks.push({ day: tick[1], value: tick[2] })
			}
		} else if (section === "templates") {
			if (line.startsWith("### ")) {
				version = startVersion(data.templates, line.slice(4))
			} else if (line.startsWith("- ") && version) {
				version.contents.push(line.slice(2))
			}
		} else if (section === "recurring") {
			const rule = parseRule(line)
			if (rule) data.recurrences.push(rule)
		}
	}
	return data
}

function parseTodo(line) {
	const m = line.match(TODO)
	if (!m) return null
	const status = STATUS[m[1]]
	const dated = m[2].match(DATED)
	const text = dated ? dated[1] : m[2]
	const when = dated ? dated[2] : null
	return { text, status, dueOn: status === "open" ? when : null, closedOn: status === "open" ? null : when }
}

// `name · label · YYYY-MM-DD`; the name may itself contain ` · `.
function startVersion(templates, heading) {
	const parts = heading.split(" · ")
	if (parts.length < 3 || !DAY.test(parts[parts.length - 1])) return null
	const effectiveFrom = parts.pop()
	const label = parts.pop()
	const name = parts.join(" · ")
	let template = templates.find((t) => t.name === name)
	if (!template) {
		template = { name, versions: [] }
		templates.push(template)
	}
	const version = { label, effectiveFrom, contents: [] }
	template.versions.push(version)
	return version
}

// `text · RRULE:… · 2026-09-01T14:00 · Zone/Name [· N min] · plan|log`
function parseRule(line) {
	if (!line.startsWith("- ")) return null
	const parts = line.slice(2).split(" · ")
	const at = parts.findIndex((p) => p.startsWith("RRULE:"))
	if (at < 1 || parts.length < at + 4) return null
	const [rrule, wall, tzid, ...rest] = parts.slice(at)
	const kind = rest.pop()
	const minutes = rest[0]?.match(/^(\d+) min$/)
	const clock = wall.match(WALL)
	if (!clock || (kind !== "plan" && kind !== "log")) return null
	const [, y, mo, d, h, mi] = clock.map(Number)
	return {
		text: parts.slice(0, at).join(" · "),
		rrule,
		dtstart: new TZDate(y, mo - 1, d, h, mi, tzid).getTime(),
		tzid,
		durationMin: minutes ? Number(minutes[1]) : null,
		kind,
	}
}
