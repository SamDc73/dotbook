// The export file: one Markdown document, readable as a journal and parsed
// back by parse.js. The log is the body, a `## YYYY-MM-DD` section per day; the
// rest are named sections. Every line is the raw text the person typed.
import { TZDate } from "@date-fns/tz"

const CHECK = { open: "[ ]", done: "[x]", trashed: "[-]" }

/**
 * @param {import("./index.js").Export} data
 * @param {string} exportedOn  the day of the export, YYYY-MM-DD
 * @returns {string}
 */
export function renderMarkdown(data, exportedOn) {
	const out = [
		"# Dotbook",
		`Exported ${exportedOn}. Import it again from Settings → Your data; what is already there is skipped.`,
		"",
	]
	for (const { day, lines } of data.days) {
		out.push(`## ${day}`)
		for (const line of lines) {
			out.push(line.kind === "plan" ? `- [ ] ${oneLine(line.text)}` : `- ${oneLine(line.text)}`)
		}
		out.push("")
	}

	out.push("## Todos")
	for (const todo of data.todos) {
		const when = todo.status === "open" ? todo.dueOn : todo.closedOn
		out.push(`- ${CHECK[todo.status]} ${oneLine(todo.text)}${when ? ` · ${when}` : ""}`)
	}
	out.push("")

	out.push("## Habits")
	for (const habit of data.habits) {
		out.push(`- ${oneLine(habit.name)} · ${habit.kind}`)
		for (const tick of habit.ticks) {
			out.push(`  - ${tick.day} · ${tick.value}`)
		}
	}
	out.push("")

	out.push("## Templates")
	for (const template of data.templates) {
		for (const version of template.versions) {
			out.push(`### ${oneLine(template.name)} · ${oneLine(version.label)} · ${version.effectiveFrom}`)
			for (const item of version.contents) {
				out.push(`- ${oneLine(item)}`)
			}
			out.push("")
		}
	}

	out.push("## Recurring")
	for (const rule of data.recurrences) {
		const duration = rule.durationMin === null ? "" : ` · ${rule.durationMin} min`
		out.push(
			`- ${oneLine(rule.text)} · ${rule.rrule} · ${wallTime(rule.dtstart, rule.tzid)} · ${rule.tzid}${duration} · ${rule.kind}`
		)
	}
	out.push("")
	return out.join("\n")
}

function oneLine(text) {
	return String(text).replace(/\s*\n\s*/g, " ")
}

/** Epoch ms as the wall clock in `tzid`: `2026-09-01T14:00`. */
export function wallTime(ms, tzid) {
	const d = new TZDate(ms, tzid)
	const pad = (n) => String(n).padStart(2, "0")
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
