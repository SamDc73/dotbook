// The server's half of app/db/markdown.js, same rules word for word: export and
// import of the whole log as one Markdown file; the format itself is
// @dotbook/core/markdown. Export reads the live rows. Import writes what is not
// already there, through the same helpers the API routes use, so every imported
// row is a real row that syncs. Passive data (ring, screen time) and links
// between rows are not in the file.

import { parseMarkdown, renderMarkdown } from "@dotbook/core/markdown"
import { localDay, typedOn } from "@dotbook/core/parse"
import { uuidv7 } from "uuidv7"
import { publish } from "../sync/publish.js"
import { today } from "../wallClock.js"
import { addEntry } from "./entries.js"
import { addHabit, setTick } from "./habits.js"
import { addVersion, createTemplate } from "./templates.js"
import { addTodo } from "./todos.js"

const SOURCE = "import:markdown"

export async function exportMarkdown(db) {
	const rules = await db.all(
		"SELECT text, rrule, dtstart, tzid, duration_min, kind FROM recurrences WHERE deleted_at IS NULL ORDER BY created_at"
	)
	const data = {
		days: groupDays(await db.all("SELECT day, text, kind FROM entries WHERE deleted_at IS NULL ORDER BY day, seq")),
		todos: (
			await db.all("SELECT text, status, due_on, closed_at FROM todos WHERE deleted_at IS NULL ORDER BY created_at")
		).map((row) => ({
			text: row.text,
			status: row.status,
			dueOn: row.due_on,
			closedOn: row.closed_at === null ? null : localDay(row.closed_at),
		})),
		habits: await habitsWithTicks(db),
		templates: groupTemplates(
			await db.all(`SELECT t.name, v.label, v.effective_from, v.contents FROM template_versions v
				JOIN templates t ON t.id = v.template_id WHERE t.deleted_at IS NULL ORDER BY t.created_at, v.created_at`)
		),
		recurrences: rules.map((row) => ({
			text: row.text,
			rrule: row.rrule,
			dtstart: row.dtstart,
			tzid: row.tzid,
			durationMin: row.duration_min,
			kind: row.kind,
		})),
	}
	const lines = data.days.reduce((n, day) => n + day.lines.length, 0)
	return { text: renderMarkdown(data, today()), lines, days: data.days.length }
}

function groupDays(rows) {
	const days = []
	for (const row of rows) {
		if (days.length === 0 || days[days.length - 1].day !== row.day) days.push({ day: row.day, lines: [] })
		days[days.length - 1].lines.push({ text: row.text, kind: row.kind === "plan" ? "plan" : "log" })
	}
	return days
}

async function habitsWithTicks(db) {
	const habits = await db.all("SELECT id, name, kind FROM habits WHERE deleted_at IS NULL ORDER BY created_at")
	const ticks = await db.all(
		"SELECT habit_id, day, value FROM habit_ticks WHERE by = 'manual' AND deleted_at IS NULL ORDER BY day"
	)
	return habits.map((habit) => ({
		name: habit.name,
		kind: habit.kind,
		ticks: ticks.filter((t) => t.habit_id === habit.id).map((t) => ({ day: t.day, value: t.value })),
	}))
}

function groupTemplates(rows) {
	const templates = []
	for (const row of rows) {
		let template = templates.find((t) => t.name === row.name)
		if (!template) {
			template = { name: row.name, versions: [] }
			templates.push(template)
		}
		template.versions.push({ label: row.label, effectiveFrom: row.effective_from, contents: JSON.parse(row.contents) })
	}
	return templates
}

/** @returns {Promise<{ lines: number, todos: number, habits: number, templates: number, recurrences: number, skipped: number }>} */
export async function importMarkdown(db, groupId, text) {
	const data = parseMarkdown(text)
	const counts = { lines: 0, todos: 0, habits: 0, templates: 0, recurrences: 0, skipped: 0 }
	await importLines(db, groupId, data.days, counts)
	await importTodos(db, groupId, data.todos, counts)
	await importHabits(db, groupId, data.habits, counts)
	await importTemplates(db, groupId, data.templates, counts)
	await importRules(db, groupId, data.recurrences, counts)
	return counts
}

async function importLines(db, groupId, days, counts) {
	const have = keys(
		await db.all("SELECT day, text FROM entries WHERE deleted_at IS NULL"),
		(r) => `${r.day}\n${r.text}`
	)
	for (const { day, lines } of days) {
		for (const line of lines) {
			if (have.has(`${day}\n${line.text}`)) {
				counts.skipped += 1
				continue
			}
			// The section is the line's day already: `ytd` moved it there once.
			await addEntry(db, groupId, { day: typedOn(line.text, day), text: line.text, source: SOURCE, kind: line.kind })
			have.add(`${day}\n${line.text}`)
			counts.lines += 1
		}
	}
}

async function importTodos(db, groupId, todos, counts) {
	const have = keys(
		await db.all("SELECT text, status FROM todos WHERE deleted_at IS NULL"),
		(r) => `${r.text}\n${r.status}`
	)
	for (const todo of todos) {
		if (have.has(`${todo.text}\n${todo.status}`)) {
			counts.skipped += 1
			continue
		}
		if (todo.status === "open") {
			await addTodo(db, groupId, { text: todo.text, dueOn: todo.dueOn })
		} else {
			// Closed on a day: noon of that day keeps it ordered among the others.
			const closedAt = todo.closedOn ? new Date(`${todo.closedOn}T12:00`).getTime() : Date.now()
			await publish(db, groupId, "todos", [
				{
					id: uuidv7(),
					text: todo.text,
					due_on: null,
					status: todo.status,
					closed_at: closedAt,
					created_at: Date.now(),
					deleted_at: null,
				},
			])
		}
		counts.todos += 1
	}
}

async function importHabits(db, groupId, habits, counts) {
	const have = keys(
		await db.all("SELECT habit_id, day FROM habit_ticks WHERE by = 'manual' AND deleted_at IS NULL"),
		(r) => `${r.habit_id}\n${r.day}`
	)
	for (const habit of habits) {
		let row = await db.get("SELECT id FROM habits WHERE name = ? AND deleted_at IS NULL", [habit.name])
		if (row) {
			counts.skipped += 1
		} else {
			await addHabit(db, groupId, { name: habit.name, kind: habit.kind })
			row = await db.get("SELECT id FROM habits WHERE name = ? AND deleted_at IS NULL", [habit.name])
			counts.habits += 1
		}
		for (const t of habit.ticks) {
			if (have.has(`${row.id}\n${t.day}`)) continue
			await setTick(db, groupId, row.id, t.day, t.value)
		}
	}
}

async function importTemplates(db, groupId, templates, counts) {
	for (const template of templates) {
		const existing = await db.get("SELECT id FROM templates WHERE name = ? AND deleted_at IS NULL", [template.name])
		const labels = existing
			? keys(await db.all("SELECT label FROM template_versions WHERE template_id = ?", [existing.id]), (r) => r.label)
			: new Set()
		const fresh = template.versions.filter((v) => !labels.has(v.label))
		counts.skipped += template.versions.length - fresh.length
		if (fresh.length === 0) continue
		let id = existing?.id
		if (!id) {
			id = await createTemplate(db, groupId, { name: template.name, ...fresh.shift() })
			counts.templates += 1
		}
		for (const version of fresh) await addVersion(db, groupId, id, version)
	}
}

async function importRules(db, groupId, rules, counts) {
	const have = keys(
		await db.all("SELECT text, rrule, dtstart FROM recurrences WHERE deleted_at IS NULL"),
		(r) => `${r.text}\n${r.rrule}\n${r.dtstart}`
	)
	for (const rule of rules) {
		if (have.has(`${rule.text}\n${rule.rrule}\n${rule.dtstart}`)) {
			counts.skipped += 1
			continue
		}
		await publish(db, groupId, "recurrences", [
			{
				id: uuidv7(),
				text: rule.text,
				rrule: rule.rrule,
				dtstart: rule.dtstart,
				tzid: rule.tzid,
				duration_min: rule.durationMin,
				kind: rule.kind,
				source: SOURCE,
				created_at: Date.now(),
				deleted_at: null,
			},
		])
		counts.recurrences += 1
	}
}

function keys(rows, key) {
	return new Set(rows.map(key))
}
