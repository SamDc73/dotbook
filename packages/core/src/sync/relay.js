// The server side: a dumb relay. It stores messages as opaque JSON text, keeps
// one merkle trie per group, and answers "what do you lack". It never reads a
// message beyond its timestamp, so it never needs to understand a schema — and
// its own two tables therefore never need a migration.

import { merkle, Timestamp } from "@actual-app/crdt"

/** Create the relay tables if missing. Fixed forever, hence no version gate. */
export function ensureRelayTables(db) {
	db.run(`CREATE TABLE IF NOT EXISTS messages_binary (
		group_id  TEXT NOT NULL,
		timestamp TEXT NOT NULL,
		content   TEXT NOT NULL,
		PRIMARY KEY (group_id, timestamp)
	)`)
	db.run(`CREATE TABLE IF NOT EXISTS messages_merkles (
		group_id TEXT PRIMARY KEY,
		merkle   TEXT NOT NULL
	)`)
}

/**
 * One sync round for one group.
 *
 * @param {import("./index.js").SyncDb} db
 * @param {{ groupId: string, clientId: string, merkle: object, messages: object[] }} request
 * @returns {{ messages: object[], merkle: object }}
 *   the messages the client lacks (none when the tries already agree) and the
 *   group's trie after storing what the client sent
 */
export function relay(db, { groupId, clientId, merkle: clientMerkle, messages }) {
	return db.transaction(() => {
		let trie = loadTrie(db, groupId)
		for (const message of messages) {
			const { changes } = db.run(
				"INSERT OR IGNORE INTO messages_binary (group_id, timestamp, content) VALUES (?, ?, ?)",
				[groupId, message.timestamp, JSON.stringify(message)]
			)
			if (changes > 0) {
				trie = merkle.insert(trie, Timestamp.parse(message.timestamp))
			}
		}
		// Pruned like Actual does: only the newest branches are kept, and the
		// hashes stay exact, so old history costs nothing to store or send.
		trie = merkle.prune(trie)
		db.run(
			"INSERT INTO messages_merkles (group_id, merkle) VALUES (?, ?) ON CONFLICT (group_id) DO UPDATE SET merkle = excluded.merkle",
			[groupId, JSON.stringify(trie)]
		)

		const divergedAt = merkle.diff(clientMerkle, trie)
		if (divergedAt === null) {
			return { messages: [], merkle: trie }
		}
		// Everything from the minute the tries diverge, except what this client
		// stamped itself — it has those already.
		const since = new Timestamp(divergedAt, 0, "0").toString()
		const rows = db.all(
			"SELECT content FROM messages_binary WHERE group_id = ? AND timestamp > ? AND timestamp NOT LIKE ? ORDER BY timestamp",
			[groupId, since, `%-${clientId}`]
		)
		return { messages: rows.map((row) => JSON.parse(row.content)), merkle: trie }
	})
}

function loadTrie(db, groupId) {
	const row = db.get("SELECT merkle FROM messages_merkles WHERE group_id = ?", [groupId])
	return row ? JSON.parse(row.merkle) : merkle.emptyTrie()
}
