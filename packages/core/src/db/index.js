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
]

/** Migrations newer than the database's current `user_version`, oldest first. */
export function pendingMigrations(currentVersion) {
	return MIGRATIONS.filter((m) => m.version > currentVersion)
}
