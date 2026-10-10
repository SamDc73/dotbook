// Keep both. When this device and another changed the same line's text while
// apart, the newer edit wins the line — last write wins, as for every field —
// and the older one is written back as a line of its own, marked
// `sync:conflict`, so neither version silently disappears.
//
// "While apart" is exact: an edit this device has not sent yet (newer than
// `since` when the sync began) and an edit arriving that it has never stored
// were each made without seeing the other. Usually only the device that syncs
// second sees both. When both do (a round that reached the server but failed on
// the way back), the copy's id is derived from the losing edit, so the two
// copies are one row and merge.

import { Timestamp } from "@actual-app/crdt"
import { applyMessages } from "./apply.js"
import { messagesForInsert } from "./messages.js"

export const CONFLICT_SOURCE = "sync:conflict"

/**
 * The lines whose text both sides changed, found before `received` is applied.
 * @param {import("./index.js").SyncDb} db
 * @param {object[]} unsent    this device's messages the server had not seen
 * @param {object[]} received  the server's answer
 * @returns {Promise<{ row: string, loser: string, version: object }[]>}
 *   the line, the losing edit's timestamp, and the losing side's columns for that line
 */
export async function findClashes(db, unsent, received) {
	const fresh = []
	for (const message of received) {
		if (
			message.dataset === "entries" &&
			!(await db.get("SELECT 1 FROM messages_crdt WHERE timestamp = ?", [message.timestamp]))
		) {
			fresh.push(message)
		}
	}
	const ours = unsent.filter((message) => message.dataset === "entries")
	const ourText = newestText(ours)
	const clashes = []
	for (const [row, theirs] of newestText(fresh)) {
		const mine = ourText.get(row)
		if (mine === undefined || JSON.stringify(mine.value) === JSON.stringify(theirs.value)) {
			continue
		}
		const loser = mine.timestamp < theirs.timestamp ? mine : theirs
		const side = loser === mine ? ours : fresh
		clashes.push({ row, loser: loser.timestamp, version: versionOf(side, row) })
	}
	return clashes
}

/**
 * Write each clash's losing version as a new line on its day. Skipped when the
 * line is gone (deleted, on either side) or the copy already exists.
 * @returns {Promise<string[]>} the ids of the lines written
 */
export async function keepBoth(db, clashes) {
	const kept = []
	for (const { row, loser, version } of clashes) {
		const id = copyId(loser)
		const line = await db.get("SELECT * FROM entries WHERE id = ?", [row])
		if (!line || line.deleted_at !== null || version.deleted_at) {
			continue
		}
		if (await db.get("SELECT 1 FROM entries WHERE id = ?", [id])) {
			continue
		}
		const day = version.day ?? line.day
		const { next } = await db.get("SELECT coalesce(max(seq), 0) + 1 AS next FROM entries WHERE day = ?", [day])
		const copy = {
			...line,
			...version,
			id,
			day,
			seq: next,
			source: CONFLICT_SOURCE,
			stamped_at: null,
			deleted_at: null,
		}
		await applyMessages(db, await messagesForInsert(db, "entries", copy))
		kept.push(id)
	}
	return kept
}

/** row → the newest `text` message for it. */
function newestText(messages) {
	const newest = new Map()
	for (const message of messages) {
		const current = newest.get(message.row)
		if (message.column === "text" && (current === undefined || message.timestamp > current.timestamp)) {
			newest.set(message.row, message)
		}
	}
	return newest
}

/** The newest value of every column one side changed on `row` — that side's version of the line. */
function versionOf(messages, row) {
	const columns = {}
	const at = {}
	for (const message of messages) {
		if (message.row === row && !(message.timestamp < (at[message.column] ?? ""))) {
			columns[message.column] = message.value
			at[message.column] = message.timestamp
		}
	}
	return columns
}

/**
 * A UUIDv7 from the losing edit: its time in the first 48 bits, a hash of its
 * timestamp (unique: wall time, counter, device) in the rest. Same edit, same id.
 */
function copyId(timestamp) {
	const time = Timestamp.parse(timestamp).millis().toString(16).padStart(12, "0")
	const bits = hash(timestamp, 0x811c9dc5) + hash(timestamp, 0x01000193) + hash(timestamp, 0x5bd1e995)
	const variant = ((Number.parseInt(bits[3], 16) & 0x3) | 0x8).toString(16)
	return `${time.slice(0, 8)}-${time.slice(8)}-7${bits.slice(0, 3)}-${variant}${bits.slice(4, 7)}-${bits.slice(7, 19)}`
}

/** FNV-1a, 32 bits as 8 hex digits, from `seed`. */
function hash(text, seed) {
	let h = seed
	for (let i = 0; i < text.length; i++) {
		h = Math.imul(h ^ text.charCodeAt(i), 0x01000193)
	}
	return (h >>> 0).toString(16).padStart(8, "0")
}
