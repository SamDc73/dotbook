// Schema for the server's one database: the relay tables, the server's own
// bookkeeping, and a replica of the client schema. The replica is what the
// classifier reads; it is filled by applying the same messages the relay stores.

import { pendingMigrations } from "@dotbook/core/db"
import { ensureRelayTables } from "@dotbook/core/sync"

export async function migrate(db) {
	await ensureRelayTables(db)
	await ensureServerTables(db)
	await migrateReplica(db)
}

/** The client migrations, gated by `user_version` exactly as on a device. */
export async function migrateReplica(db) {
	const { user_version: version } = await db.get("PRAGMA user_version")
	for (const migration of pendingMigrations(version)) {
		await db.transaction(async () => {
			for (const statement of migration.statements) {
				await db.run(statement)
			}
			await db.run(`PRAGMA user_version = ${migration.version}`)
		})
	}
}

// Which days the classifier has finished, with which model and prompt version.
// Server-only, never synced — a phone has no use for it — so it lives beside
// the relay tables rather than in the client migrations. Deleting rows re-runs.
async function ensureServerTables(db) {
	await db.run(`CREATE TABLE IF NOT EXISTS classification_runs (
		id             TEXT PRIMARY KEY,
		day            TEXT    NOT NULL,
		model          TEXT    NOT NULL,
		prompt_version TEXT    NOT NULL,
		created_at     INTEGER NOT NULL
	)`)
}
