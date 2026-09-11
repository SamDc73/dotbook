// Which tables sync, and how a message addresses one row in each.
//
// Column names in SQL come from this list and never from the wire: a relay
// forwards whatever a client sends, so a column name taken from a message would
// be a SQL injection path straight into every device.
//
// `entry_items` is deliberately absent — it is a derived cache, rebuilt from
// `entries` on each device. Later phases add their tables here.

export const SYNCED = {
	entries: {
		keys: ["id"],
		columns: ["day", "seq", "ts_start", "ts_end", "text", "kind", "source", "created_at", "deleted_at"],
	},
	templates: {
		keys: ["id"],
		columns: ["name", "created_at", "deleted_at"],
	},
	template_versions: {
		keys: ["id"],
		columns: ["template_id", "label", "effective_from", "contents", "created_at"],
	},
	template_uses: {
		keys: ["entry_id"],
		columns: ["template_id", "version_id", "snapshot", "deviation"],
	},
	template_prompts: {
		keys: ["id"],
		columns: ["template_id", "deviation", "answer", "answered_at"],
	},
	recurrences: {
		keys: ["id"],
		columns: ["text", "rrule", "dtstart", "tzid", "duration_min", "kind", "source", "created_at", "deleted_at"],
	},
	recurrence_instances: {
		keys: ["recurrence_id", "occurrence_ts"],
		columns: ["entry_id"],
	},
	// Written by the server (browser time) and, later, the phone (app time).
	time_rollups: {
		keys: ["day", "source", "device", "key"],
		columns: ["seconds"],
	},
	habits: {
		keys: ["id"],
		columns: ["name", "kind", "created_at", "deleted_at"],
	},
	habit_ticks: {
		keys: ["id"],
		columns: ["habit_id", "day", "value", "by", "model", "prompt_version", "reasoning", "created_at", "deleted_at"],
	},
}

// A message's `row` is the primary key as text. Composite keys are joined with
// a character that cannot appear in a UUID or a number.
const KEY_SEPARATOR = "|"

/** `{ id: "…" }` → `"…"`; `{ recurrence_id, occurrence_ts }` → `"…|1712345"`. */
export function rowKey(dataset, row) {
	return SYNCED[dataset].keys.map((key) => String(row[key])).join(KEY_SEPARATOR)
}

/** The inverse of `rowKey`: the key values in `SYNCED[dataset].keys` order. */
export function keyValues(rowKeyText) {
	return rowKeyText.split(KEY_SEPARATOR)
}
