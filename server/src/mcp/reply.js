// How every tool answers, and how rows look to an AI tool: camelCase, times as
// ISO 8601 in the server's zone (epoch ms mean nothing to a model), and only the
// columns that carry meaning — no seq, no sync bookkeeping.

import { isoLocal, shiftDay, today } from "../wallClock.js"

/** The result as JSON text — the one content type every client hands the model. */
export function reply(value) {
	return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] }
}

/** `from`…`to` with the tools' defaults: through today, a week back. */
export function range({ from, to }, days = 7) {
	const last = to ?? today()
	return { from: from ?? shiftDay(last, 1 - days), to: last }
}

export function line(row) {
	return {
		id: row.id,
		day: row.day,
		kind: row.kind,
		text: row.text,
		start: isoLocal(row.ts_start),
		end: isoLocal(row.ts_end),
		source: row.source,
		template: row.template_name ? { name: row.template_name, version: row.version_label } : undefined,
	}
}

export function todo(row) {
	return {
		id: row.id,
		text: row.text,
		status: row.status,
		dueOn: row.due_on,
		daysLate: row.days_late ?? undefined,
		planned: row.planned_start
			? { day: row.planned_day, start: isoLocal(row.planned_start), end: isoLocal(row.planned_end) }
			: undefined,
		startedAt: row.started_ts ? isoLocal(row.started_ts) : undefined,
		closedAt: row.closed_at ? isoLocal(row.closed_at) : undefined,
		createdAt: isoLocal(row.created_at),
	}
}
