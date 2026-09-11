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
export async function publish(db, groupId, dataset, rows) {
	const messages = []
	for (const row of rows) {
		messages.push(...(await messagesForInsert(db, dataset, row)))
	}
	await send(db, groupId, messages)
}

/**
 * Change `changes` on the row at `key` and publish the change.
 * @param {object} key  `{ id }`, or every key column for a composite key
 */
export async function publishUpdate(db, groupId, dataset, key, changes) {
	await send(db, groupId, await messagesForUpdate(db, dataset, key, changes))
}

// Apply locally, then run one client sync round against the in-process relay.
// The round carries every own message the relay has not seen yet — not only
// this batch — so nothing is lost if an earlier round was interrupted.
async function send(db, groupId, messages) {
	await applyMessages(db, messages)
	const request = await buildSyncRequest(db, groupId)
	await receiveSyncResponse(db, request, await relay(db, request))
}
