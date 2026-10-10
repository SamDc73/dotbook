// Export and import as one Markdown file. Phone, web and server share this so
// a file written anywhere reads the same everywhere.
//
// @typedef {{
//   days: { day: string, lines: { text: string, kind: "log"|"plan" }[] }[],
//   todos: { text: string, status: "open"|"done"|"trashed", dueOn: string|null, closedOn: string|null }[],
//   habits: { name: string, kind: "do"|"avoid", ticks: { day: string, value: "kept"|"broken" }[] }[],
//   templates: { name: string, versions: { label: string, effectiveFrom: string, contents: string[] }[] }[],
//   recurrences: { text: string, rrule: string, dtstart: number, tzid: string, durationMin: number|null, kind: "plan"|"log" }[],
// }} Export
export { parseMarkdown } from "./parse.js"
export { renderMarkdown, wallTime } from "./render.js"
