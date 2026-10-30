import { parseMarkdown } from "@dotbook/core/markdown"
import { api } from "../lib/api"
import { noteChange } from "../lib/changes"

// Web twin of db/markdown.js: export and import of the whole log as one
// Markdown file. The rows live on the server, so export reads the file it
// renders and import hands the file over; the format itself is
// @dotbook/core/markdown, and import's counts come back from the server. The
// `db` parameter is accepted and ignored.

export async function exportMarkdown(_db) {
	// CONTRACT NOTE: lib/api.js's `raw` currently resolves to the Response
	// object; the contract says text. Either is accepted here.
	const res = await api("/api/v1/export", { raw: true })
	const text = typeof res === "string" ? res : await res.text()
	// The endpoint returns the file only, so the export counts the screen shows
	// (`lines` over `days`) are read back out of the very text being saved.
	const data = parseMarkdown(text)
	const lines = data.days.reduce((n, day) => n + day.lines.length, 0)
	return { text, lines, days: data.days.length }
}

/** @returns {Promise<{ lines: number, todos: number, habits: number, templates: number, recurrences: number, skipped: number }>} */
export async function importMarkdown(_db, text) {
	const data = await api("/api/v1/import", { method: "POST", body: { markdown: text } })
	const added = data.added ?? data
	noteChange()
	return {
		lines: added.lines ?? 0,
		todos: added.todos ?? 0,
		habits: added.habits ?? 0,
		templates: added.templates ?? 0,
		recurrences: added.recurrences ?? 0,
		skipped: added.skipped ?? 0,
	}
}
