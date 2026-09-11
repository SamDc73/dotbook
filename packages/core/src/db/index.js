// The SQLite schema, shared by phone, web, and server.
//
// Migrations are additive and gated by `PRAGMA user_version`. Each phase that
// needs new tables appends a new entry — nothing here is ever edited once it
// has shipped. One statement per string so a failure names the exact statement.
//
// Column conventions (see AGENTS.md → Data & Storage):
//   ids            UUIDv7 text, generated on the writing device
//   *_at / ts_*    UTC epoch milliseconds
//   day            local calendar date, YYYY-MM-DD
//   deleted_at     soft delete only — a hard delete cannot be synced

export const MIGRATIONS = [
	{
		version: 1,
		statements: [
			`CREATE TABLE entries (
				id         TEXT PRIMARY KEY,
				day        TEXT    NOT NULL,
				seq        INTEGER NOT NULL,
				ts_start   INTEGER,
				ts_end     INTEGER,
				text       TEXT    NOT NULL,
				kind       TEXT    NOT NULL DEFAULT 'log',
				source     TEXT    NOT NULL DEFAULT 'manual',
				created_at INTEGER NOT NULL,
				deleted_at INTEGER
			)`,
			"CREATE INDEX entries_by_day ON entries (day, seq)",
			`CREATE TABLE entry_items (
				id         TEXT PRIMARY KEY,
				entry_id   TEXT NOT NULL REFERENCES entries (id),
				name       TEXT NOT NULL,
				qty        REAL,
				unit       TEXT,
				extractor  TEXT NOT NULL,
				confidence REAL
			)`,
			"CREATE INDEX entry_items_by_entry ON entry_items (entry_id)",
		],
	},
	{
		// Phase 3 — versioned templates. See V0.1 → "Versioned templates".
		version: 2,
		statements: [
			`CREATE TABLE templates (
				id         TEXT PRIMARY KEY,
				name       TEXT    NOT NULL UNIQUE,
				created_at INTEGER NOT NULL,
				deleted_at INTEGER
			)`,
			// contents: JSON array of item strings, e.g. ["caffeine 100mg", "l-theanine 200mg"]
			`CREATE TABLE template_versions (
				id             TEXT PRIMARY KEY,
				template_id    TEXT    NOT NULL REFERENCES templates (id),
				label          TEXT    NOT NULL,
				effective_from TEXT    NOT NULL,
				contents       TEXT    NOT NULL,
				created_at     INTEGER NOT NULL
			)`,
			"CREATE INDEX template_versions_by_template ON template_versions (template_id, effective_from)",
			// snapshot: the version's contents copied at logging time — history does not move.
			// deviation: JSON {added, removed, changed} against that snapshot, or NULL.
			`CREATE TABLE template_uses (
				entry_id    TEXT PRIMARY KEY REFERENCES entries (id),
				template_id TEXT NOT NULL REFERENCES templates (id),
				version_id  TEXT NOT NULL REFERENCES template_versions (id),
				snapshot    TEXT NOT NULL,
				deviation   TEXT
			)`,
			"CREATE INDEX template_uses_by_template ON template_uses (template_id)",
			// Every deviation ever asked about, with the answer. Asked once, ever.
			`CREATE TABLE template_prompts (
				id          TEXT PRIMARY KEY,
				template_id TEXT    NOT NULL REFERENCES templates (id),
				deviation   TEXT    NOT NULL,
				answer      TEXT    NOT NULL,
				answered_at INTEGER NOT NULL
			)`,
			"CREATE INDEX template_prompts_by_template ON template_prompts (template_id)",
		],
	},
	{
		// Phase 6 — recurring events. See V0.1 → feature 5.
		version: 3,
		statements: [
			// rrule: RFC 5545 RRULE text with no DTSTART inside — the start (and the
			// time of day) is `dtstart`, read in `tzid`. duration_min NULL = point event.
			`CREATE TABLE recurrences (
				id           TEXT PRIMARY KEY,
				text         TEXT    NOT NULL,
				rrule        TEXT    NOT NULL,
				dtstart      INTEGER NOT NULL,
				tzid         TEXT    NOT NULL,
				duration_min INTEGER,
				kind         TEXT    NOT NULL DEFAULT 'plan',
				source       TEXT    NOT NULL DEFAULT 'manual',
				created_at   INTEGER NOT NULL,
				deleted_at   INTEGER
			)`,
			// One row per occurrence that has been materialised into an entry. This is
			// what makes materialisation idempotent and per-occurrence edits safe: once
			// an occurrence has its entry it is never generated again, so editing or
			// soft-deleting that entry changes only that day and the series is untouched.
			`CREATE TABLE recurrence_instances (
				recurrence_id TEXT    NOT NULL REFERENCES recurrences (id),
				occurrence_ts INTEGER NOT NULL,
				entry_id      TEXT    NOT NULL REFERENCES entries (id),
				PRIMARY KEY (recurrence_id, occurrence_ts)
			)`,
		],
	},
	{
		// Phase 7 — sync. See V0.1 → feature 9.
		version: 4,
		statements: [
			// One row per column write, ever. The tables above are a materialisation
			// of the newest message per (dataset, row, column); this is the source of
			// truth, and it merges by set union so conflicts cannot exist. `timestamp`
			// is a 46-character hybrid-logical-clock string, so sorting by it is
			// sorting by causality. `value` is JSON text so null, numbers and strings
			// round-trip unchanged.
			`CREATE TABLE messages_crdt (
				timestamp TEXT PRIMARY KEY,
				dataset   TEXT NOT NULL,
				row       TEXT NOT NULL,
				column    TEXT NOT NULL,
				value     TEXT NOT NULL
			)`,
			"CREATE INDEX messages_crdt_by_field ON messages_crdt (dataset, row, column, timestamp)",
			// This device's clock and merkle trie — exactly one row, ever — and
			// `since`: the newest own message the server is known to have.
			`CREATE TABLE messages_clock (
				id    INTEGER PRIMARY KEY CHECK (id = 1),
				clock TEXT NOT NULL,
				since TEXT NOT NULL DEFAULT ''
			)`,
		],
	},
	{
		// Phase 5e — todos. See V0.1 → feature 17.
		version: 5,
		statements: [
			// due_on: null is the queue. Written once by a person and never by a job —
			// carry-over is a view, so the lateness chip is always counted from the
			// original date. status: open | done | trashed (trashed is a state, not a delete).
			`CREATE TABLE todos (
				id         TEXT PRIMARY KEY,
				text       TEXT    NOT NULL,
				due_on     TEXT,
				status     TEXT    NOT NULL DEFAULT 'open',
				closed_at  INTEGER,
				created_at INTEGER NOT NULL,
				deleted_at INTEGER
			)`,
			"CREATE INDEX todos_by_status ON todos (status, due_on)",
			// One relation, three reasons: timer | matched point at past lines and are
			// what time spent sums over; planned points at the plan line whose window
			// the todo shows — read live, never copied onto the todo.
			`CREATE TABLE todo_links (
				todo_id      TEXT NOT NULL REFERENCES todos (id),
				entry_id     TEXT NOT NULL REFERENCES entries (id),
				origin       TEXT NOT NULL,
				confirmed_at INTEGER,
				PRIMARY KEY (todo_id, entry_id)
			)`,
		],
	},
	{
		// Phase 4 — reminders and alarms. See V0.1 → feature 4 and feature 13.
		version: 6,
		statements: [
			// A reminder belongs to a template (daily at `at`, HH:MM local) or to
			// one entry (a plan block, fired at its ts_start) — never both.
			// `escalation_min` is T2: the second nudge, that many minutes after T1,
			// sent only on days nothing was answered.
			`CREATE TABLE reminders (
				id             TEXT PRIMARY KEY,
				template_id    TEXT REFERENCES templates (id),
				entry_id       TEXT REFERENCES entries (id),
				at             TEXT,
				escalation_min INTEGER,
				style          TEXT    NOT NULL DEFAULT 'notify',
				created_at     INTEGER NOT NULL,
				deleted_at     INTEGER,
				CHECK ((template_id IS NULL) <> (entry_id IS NULL))
			)`,
			"CREATE INDEX reminders_by_template ON reminders (template_id)",
			"CREATE INDEX reminders_by_entry ON reminders (entry_id)",
			// Every tap on a reminder: yes | not_yet | snooze. `key` names the exact
			// notification fire that was answered, so the same tap arriving twice
			// (foreground listener and background task) is stored once.
			`CREATE TABLE reminder_answers (
				id          TEXT PRIMARY KEY,
				reminder_id TEXT    NOT NULL REFERENCES reminders (id),
				day         TEXT    NOT NULL,
				answer      TEXT    NOT NULL,
				answered_at INTEGER NOT NULL,
				key         TEXT    NOT NULL UNIQUE
			)`,
			"CREATE INDEX reminder_answers_by_day ON reminder_answers (reminder_id, day)",
		],
	},
	{
		// Phase 12 — RingConn CSV import. See V0.1 → feature 8 and ringconn/README.md.
		// Observations, not caches: they come from a device, so they are kept and
		// synced like entries. Each table's natural key is the CSV's own key, which
		// is what makes re-importing an overlapping export idempotent.
		version: 7,
		statements: [
			// One row per sleep session. A day can hold several (naps), so the key is
			// the session's exact start, not the date. Minutes as the ring reports them.
			`CREATE TABLE sleep_sessions (
				id         TEXT PRIMARY KEY,
				start_ts   INTEGER NOT NULL UNIQUE,
				end_ts     INTEGER NOT NULL,
				asleep_ts  INTEGER,
				wake_ts    INTEGER,
				ratio      REAL,
				asleep_min INTEGER,
				awake_min  INTEGER,
				rem_min    INTEGER,
				light_min  INTEGER,
				deep_min   INTEGER,
				source     TEXT    NOT NULL,
				created_at INTEGER NOT NULL
			)`,
			// One row per calendar day.
			`CREATE TABLE daily_vitals (
				day        TEXT PRIMARY KEY,
				avg_hr     INTEGER,
				min_hr     INTEGER,
				max_hr     INTEGER,
				avg_spo2   REAL,
				min_spo2   REAL,
				max_spo2   REAL,
				avg_hrv    INTEGER,
				min_hrv    INTEGER,
				max_hrv    INTEGER,
				source     TEXT    NOT NULL,
				created_at INTEGER NOT NULL
			)`,
			`CREATE TABLE daily_activity (
				day        TEXT PRIMARY KEY,
				steps      INTEGER,
				kcal       INTEGER,
				source     TEXT    NOT NULL,
				created_at INTEGER NOT NULL
			)`,
		],
	},
	{
		// Browser & app time. See V0.1 → feature 7.
		version: 8,
		statements: [
			// One row per (day, source, device, key). `key` is a hostname for
			// ext:firefox and a package name for android:usagestats. The server ADDS
			// seconds as batches arrive; a row is never replaced wholesale.
			//
			// The double-count rule: per-site rows from the extension are a breakdown
			// of the browser's own app time. Never sum ext:firefox rows with the
			// browser's android:usagestats row — that counts every minute twice.
			`CREATE TABLE time_rollups (
				day     TEXT    NOT NULL,
				source  TEXT    NOT NULL,
				device  TEXT    NOT NULL,
				key     TEXT    NOT NULL,
				seconds INTEGER NOT NULL,
				PRIMARY KEY (day, source, device, key)
			)`,
		],
	},
	{
		// Phase 9 — habits + LLM classification. See V0.1 → feature 6.
		version: 9,
		statements: [
			// kind: do | avoid. "no porn" is an avoid habit; "meditate" is a do habit.
			`CREATE TABLE habits (
				id         TEXT PRIMARY KEY,
				name       TEXT    NOT NULL,
				kind       TEXT    NOT NULL,
				created_at INTEGER NOT NULL,
				deleted_at INTEGER
			)`,
			// A tick is one verdict about one habit on one day: value kept | broken,
			// by manual | llm. A person's tick always wins over the model's — see
			// core/habits effectiveTick. Every llm tick keeps the model, prompt
			// version and reasoning so it can be audited and re-run. Soft delete
			// only: a superseded proposal stays on record.
			`CREATE TABLE habit_ticks (
				id             TEXT PRIMARY KEY,
				habit_id       TEXT    NOT NULL REFERENCES habits (id),
				day            TEXT    NOT NULL,
				value          TEXT    NOT NULL,
				by             TEXT    NOT NULL,
				model          TEXT,
				prompt_version TEXT,
				reasoning      TEXT,
				created_at     INTEGER NOT NULL,
				deleted_at     INTEGER
			)`,
			"CREATE INDEX habit_ticks_by_day ON habit_ticks (habit_id, day)",
		],
	},
	{
		version: 10,
		statements: [
			// One row per kept voice recording, pointing at the line it became.
			// Local only — audio does not sync in V0.1; the transcript is the
			// line's text. `engine` names the recognizer so a better one later
			// can re-run over old recordings: transcripts are derived data.
			`CREATE TABLE voice_notes (
				id          TEXT PRIMARY KEY,
				entry_id    TEXT    NOT NULL REFERENCES entries (id),
				path        TEXT    NOT NULL,
				duration_ms INTEGER,
				engine      TEXT    NOT NULL,
				created_at  INTEGER NOT NULL
			)`,
			"CREATE INDEX voice_notes_by_entry ON voice_notes (entry_id)",
		],
	},
]

/** Migrations newer than the database's current `user_version`, oldest first. */
export function pendingMigrations(currentVersion) {
	return MIGRATIONS.filter((m) => m.version > currentVersion)
}
