// One SQLite file per user: relay log, replica, classifier runs. Core's schema
// stays a device's, and one person's data is one file to back up or delete.

import { join } from "node:path"
import { openDatabase } from "./adapter.js"
import { migrate } from "./index.js"

/**
 * @param {string} dataDir  where `users/<id>.sqlite` live
 * @returns {(userId: string) => Promise<import("@dotbook/core/sync").SyncDb>}
 */
export function userDatabases(dataDir) {
	const open = new Map()
	return async (userId) => {
		let db = open.get(userId)
		if (!db) {
			db = openDatabase(join(dataDir, "users", `${userId}.sqlite`))
			await migrate(db)
			open.set(userId, db)
		}
		return db
	}
}
