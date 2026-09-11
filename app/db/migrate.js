import { pendingMigrations } from "@dotbook/core/db"

// Brings the database up to the newest schema in @dotbook/core/db.
// Runs once, before the first screen renders (SQLiteProvider onInit).
export async function migrate(db) {
	await db.execAsync("PRAGMA journal_mode = WAL")
	const { user_version: version } = await db.getFirstAsync("PRAGMA user_version")

	for (const migration of pendingMigrations(version)) {
		// withTransactionAsync works on every platform; the exclusive variant does not exist on web.
		await db.withTransactionAsync(async () => {
			for (const statement of migration.statements) {
				await db.execAsync(statement)
			}
			await db.execAsync(`PRAGMA user_version = ${migration.version}`)
		})
	}
}
