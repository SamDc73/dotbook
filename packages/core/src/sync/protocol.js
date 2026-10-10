// The client side of a sync round — modelled on Actual Budget's fullSync.
//
//   1. Send our merkle trie and every own message newer than `since`.
//   2. The relay stores what it lacks and answers with the messages we lack
//      (everything after the minute our tries diverge) and its own trie.
//   3. Apply them. If the tries now agree we are done; if not, lower `since`
//      to the divergence point so the next round re-sends what the server lost.

import { Timestamp } from "@actual-app/crdt"
import { applyMessages } from "./apply.js"
import { rebuildTrie, withClock } from "./clock.js"
import { divergence } from "./merkle.js"

// Actual uses the same bound: two devices that keep diverging after this many
// rounds have a bug, not a big backlog.
const MAX_ROUNDS = 10

/**
 * The request body for one round.
 * @param {import("./index.js").SyncDb} db
 * @param {string} groupId  the user — one group per person, every device shares it
 */
export function buildSyncRequest(db, groupId) {
	return withClock(db, async (clock) => {
		const clientId = clock.timestamp.node()
		const { since } = await db.get("SELECT since FROM messages_clock WHERE id = 1")
		// Only messages this device stamped: anything else came from the server.
		const rows = await db.all(
			"SELECT timestamp, dataset, row, column, value FROM messages_crdt WHERE timestamp > ? AND timestamp LIKE ? ORDER BY timestamp",
			[since, `%-${clientId}`]
		)
		const messages = rows.map((row) => ({ ...row, value: JSON.parse(row.value) }))
		return { groupId, clientId, merkle: clock.merkle, messages }
	})
}

/**
 * Take in the server's answer. Resolves true when both sides hold the same set.
 * @param {import("./index.js").SyncDb} db
 * @param {Awaited<ReturnType<typeof buildSyncRequest>>} request  what was sent
 * @param {{ messages: object[], merkle: object }} response
 */
export async function receiveSyncResponse(db, request, response) {
	await applyMessages(db, response.messages)
	const divergedAt = await withClock(db, (clock) => divergence(clock.merkle, response.merkle))

	let since = request.messages.at(-1)?.timestamp
	if (divergedAt !== null) {
		since = new Timestamp(divergedAt, 0, "0").toString()
	}
	if (since !== undefined) {
		await db.run("UPDATE messages_clock SET since = ? WHERE id = 1", [since])
	}
	return divergedAt === null
}

/**
 * Sync until both sides agree. `post(request)` is the transport — `fetch` in
 * the app, `app.request` in tests — and returns the parsed response body.
 * @returns {Promise<number>} rounds it took
 */
export async function sync(db, groupId, post) {
	let stalledAt = null
	let rebuilt = false
	for (let round = 1; round <= MAX_ROUNDS; round++) {
		const request = await buildSyncRequest(db, groupId)
		const response = await post(request)
		if (await receiveSyncResponse(db, request, response)) {
			return round
		}
		// Two rounds stopping at the same point made no progress: this device's
		// trie no longer matches its messages. Rebuild it from them, once.
		const { since } = await db.get("SELECT since FROM messages_clock WHERE id = 1")
		if (since === stalledAt && !rebuilt) {
			await rebuildTrie(db)
			rebuilt = true
		}
		stalledAt = since
	}
	throw new Error(`sync did not converge in ${MAX_ROUNDS} rounds`)
}
