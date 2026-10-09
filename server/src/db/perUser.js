// Every user has their own SQLite file: relay log, replica, classifier runs.
// Core's schema stays exactly a device's (no user column anywhere), one
// person's data is one file to back up or delete, and nothing one user does
// can reach another's rows. Opened on first use, kept open.

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
