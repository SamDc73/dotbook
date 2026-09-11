// The client side of a sync round — modelled on Actual Budget's fullSync.
//
//   1. Send our merkle trie and every own message newer than `since`.
//   2. The relay stores what it lacks and answers with the messages we lack
//      (everything after the minute our tries diverge) and its own trie.
//   3. Apply them. If the tries now agree we are done; if not, lower `since`
//      to the divergence point so the next round re-sends what the server lost.

import { merkle, Timestamp } from "@actual-app/crdt"
import { applyMessages } from "./apply.js"
import { clockFor } from "./clock.js"

// Actual uses the same bound: two devices that keep diverging after this many
// rounds have a bug, not a big backlog.
const MAX_ROUNDS = 10

/**
 * The request body for one round.
 * @param {import("./index.js").SyncDb} db
 * @param {string} groupId  the user — one group per person, every device shares it
 */
export function buildSyncRequest(db, groupId) {
	const clock = clockFor(db)
	const clientId = clock.timestamp.node()
	const { since } = db.get("SELECT since FROM messages_clock WHERE id = 1")
	// Only messages this device stamped: anything else came from the server.
	const rows = db.all(
		"SELECT timestamp, dataset, row, column, value FROM messages_crdt WHERE timestamp > ? AND timestamp LIKE ? ORDER BY timestamp",
		[since, `%-${clientId}`]
	)
	const messages = rows.map((row) => ({ ...row, value: JSON.parse(row.value) }))
	return { groupId, clientId, merkle: clock.merkle, messages }
}

/**
 * Take in the server's answer. Returns true when both sides hold the same set.
 * @param {import("./index.js").SyncDb} db
 * @param {ReturnType<typeof buildSyncRequest>} request  what was sent
 * @param {{ messages: object[], merkle: object }} response
 */
export function receiveSyncResponse(db, request, response) {
	applyMessages(db, response.messages)
	const clock = clockFor(db)
	const divergedAt = merkle.diff(clock.merkle, response.merkle)

	let since = request.messages.at(-1)?.timestamp
	if (divergedAt !== null) {
		since = new Timestamp(divergedAt, 0, "0").toString()
	}
	if (since !== undefined) {
		db.run("UPDATE messages_clock SET since = ? WHERE id = 1", [since])
	}
	return divergedAt === null
}

/**
 * Sync until both sides agree. `post(request)` is the transport — `fetch` in
 * the app, `app.request` in tests — and returns the parsed response body.
 * @returns {Promise<number>} rounds it took
 */
export async function sync(db, groupId, post) {
	for (let round = 1; round <= MAX_ROUNDS; round++) {
		const request = buildSyncRequest(db, groupId)
		const response = await post(request)
		if (receiveSyncResponse(db, request, response)) {
			return round
		}
	}
	throw new Error(`sync did not converge in ${MAX_ROUNDS} rounds`)
}
