// Browser time from the Firefox extension → `time_rollups`, published to the group.
//
// Each batch is ADDED to the row for (day, source, device, site). The server is
// the only writer of ext:firefox rows — the extension never reads back and no
// device edits them — so read-add-write here cannot race another writer.
//
// The double-count rule (extension/README.md): these per-site rows are a
// breakdown of the browser's own app time. Never sum them with the browser's
// android:usagestats row; that counts every minute twice.

import { publish, publishUpdate } from "../sync/publish.js"

/**
 * @param {import("@dotbook/core/sync").SyncDb} db
 * @param {string} groupId
 * @param {{ source: string, device: string, rollups: { day: string, site: string, seconds: number }[] }} batch
 * @returns {Promise<number>} rollups taken in
 */
export async function addBrowserTime(db, groupId, { source, device, rollups }) {
	for (const { day, site, seconds } of rollups) {
		const key = { day, source, device, key: site }
		const row = await db.get(
			"SELECT seconds FROM time_rollups WHERE day = ? AND source = ? AND device = ? AND key = ?",
			[day, source, device, site]
		)
		if (row) {
			await publishUpdate(db, groupId, "time_rollups", key, { seconds: row.seconds + seconds })
		} else {
			await publish(db, groupId, "time_rollups", [{ ...key, seconds }])
		}
	}
	return rollups.length
}
