// Rows the server creates itself — browser time, the classifier's ticks.
//
// The relay only forwards what clients post, so a row born here must take the
// same road a device's row takes: stamped by this server's own clock, applied
// to the replica, then handed to the relay so it lands in the group's log and
// reaches every device on its next sync. The server is a client too; the only
// difference is that its transport is a function call instead of HTTP.

import {
	applyMessages,
	buildSyncRequest,
	messagesForInsert,
	messagesForUpdate,
	receiveSyncResponse,
	relay,
} from "@dotbook/core/sync"

/**
 * Create `rows` in `dataset` and publish them to the group.
 * @param {import("@dotbook/core/sync").SyncDb} db
 * @param {string} groupId
 * @param {string} dataset  a key of SYNCED
 * @param {object[]} rows   full rows, keys included
 */
export function publish(db, groupId, dataset, rows) {
	send(
		db,
		groupId,
		rows.flatMap((row) => messagesForInsert(db, dataset, row))
	)
}

/**
 * Change `changes` on the row at `key` and publish the change.
 * @param {object} key  `{ id }`, or every key column for a composite key
 */
export function publishUpdate(db, groupId, dataset, key, changes) {
	send(db, groupId, messagesForUpdate(db, dataset, key, changes))
}

// Apply locally, then run one client sync round against the in-process relay.
// The round carries every own message the relay has not seen yet — not only
// this batch — so nothing is lost if an earlier round was interrupted.
function send(db, groupId, messages) {
	applyMessages(db, messages)
	const request = buildSyncRequest(db, groupId)
	receiveSyncResponse(db, request, relay(db, request))
}
