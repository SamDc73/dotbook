// Schema for the server's one database: the relay tables plus a replica of the
// client schema. The replica is what the LLM classifier (phase 9) reads; it is
// filled by applying the same messages the relay stores.

import { pendingMigrations } from "@dotbook/core/db"
import { ensureRelayTables } from "@dotbook/core/sync"

export function migrate(db) {
	ensureRelayTables(db)
	migrateReplica(db)
}

/** The client migrations, gated by `user_version` exactly as on a device. */
export function migrateReplica(db) {
	const { user_version: version } = db.get("PRAGMA user_version")
	for (const migration of pendingMigrations(version)) {
		db.transaction(() => {
			for (const statement of migration.statements) {
				db.run(statement)
			}
			db.run(`PRAGMA user_version = ${migration.version}`)
		})
	}
}
