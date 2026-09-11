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
	todos: {
		keys: ["id"],
		columns: ["text", "due_on", "status", "closed_at", "created_at", "deleted_at"],
	},
	todo_links: {
		keys: ["todo_id", "entry_id"],
		columns: ["origin", "confirmed_at"],
	},
	reminders: {
		keys: ["id"],
		columns: ["template_id", "entry_id", "at", "escalation_min", "style", "created_at", "deleted_at"],
	},
	reminder_answers: {
		keys: ["id"],
		columns: ["reminder_id", "day", "answer", "answered_at", "key"],
	},
	// Ring observations. `voice_notes` is deliberately absent: its audio file
	// lives on one device, so the row would point at nothing elsewhere.
	sleep_sessions: {
		keys: ["id"],
		columns: [
			"start_ts",
			"end_ts",
			"asleep_ts",
			"wake_ts",
			"ratio",
			"asleep_min",
			"awake_min",
			"rem_min",
			"light_min",
			"deep_min",
			"source",
			"created_at",
		],
	},
	daily_vitals: {
		keys: ["day"],
		columns: [
			"avg_hr",
			"min_hr",
			"max_hr",
			"avg_spo2",
			"min_spo2",
			"max_spo2",
			"avg_hrv",
			"min_hrv",
			"max_hrv",
			"source",
			"created_at",
		],
	},
	daily_activity: {
		keys: ["day"],
		columns: ["steps", "kcal", "source", "created_at"],
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
