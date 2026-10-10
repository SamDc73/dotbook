// The client side of a sync round — modelled on Actual Budget's fullSync.
//
//   1. Send our merkle trie and every own message newer than `since`.
//   2. The relay stores what it lacks and answers with the messages we lack
//      (everything after the minute our tries diverge) and its own trie.
//   3. Apply them. If the tries now agree we are done; if not, lower `since`
//      to the divergence point so the next round re-sends what the server lost.
//      A line whose text both sides changed keeps both versions (conflicts.js);
//      the copy is a new own message, so the next round carries it.

import { Timestamp } from "@actual-app/crdt"
import { applyMessages } from "./apply.js"
import { rebuildTrie, withClock } from "./clock.js"
import { findClashes, keepBoth } from "./conflicts.js"
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
 * Take in the server's answer. `done` is true when both sides hold the same set;
 * `kept` lists the lines written to keep both versions of a clash.
 * @param {import("./index.js").SyncDb} db
 * @param {Awaited<ReturnType<typeof buildSyncRequest>>} request  what was sent
 * @param {{ messages: object[], merkle: object }} response
 * @param {string} [unsentAfter]  `since` when the sync began: own messages newer
 *   than it had not reached the server, so they can clash with what arrives
 * @returns {Promise<{ done: boolean, kept: string[] }>}
 */
export async function receiveSyncResponse(db, request, response, unsentAfter = "") {
	const unsent = request.messages.filter((message) => message.timestamp > unsentAfter)
	const clashes = await findClashes(db, unsent, response.messages)
	await applyMessages(db, response.messages)
	const kept = await keepBoth(db, clashes)
	const divergedAt = await withClock(db, (clock) => divergence(clock.merkle, response.merkle))

	let since = request.messages.at(-1)?.timestamp
	if (divergedAt !== null) {
		since = new Timestamp(divergedAt, 0, "0").toString()
	}
	if (since !== undefined) {
		await db.run("UPDATE messages_clock SET since = ? WHERE id = 1", [since])
	}
	return { done: divergedAt === null, kept }
}

/**
 * Sync until both sides agree. `post(request)` is the transport — `fetch` in
 * the app, `app.request` in tests — and returns the parsed response body.
 * @returns {Promise<{ rounds: number, kept: string[] }>} rounds it took, and
 *   the lines it wrote to keep both versions of a clash
 */
export async function sync(db, groupId, post) {
	// Read once: a round can lower `since` to re-send messages the server already
	// has, and those must not count as unsent when looking for clashes.
	// A device that never wrote has no clock row yet, and nothing unsent.
	const unsentAfter = (await db.get("SELECT since FROM messages_clock WHERE id = 1"))?.since ?? ""
	const kept = []
	let stalledAt = null
	let rebuilt = false
	for (let round = 1; round <= MAX_ROUNDS; round++) {
		const request = await buildSyncRequest(db, groupId)
		const response = await post(request)
		const result = await receiveSyncResponse(db, request, response, unsentAfter)
		kept.push(...result.kept)
		if (result.done) {
			return { rounds: round, kept }
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
