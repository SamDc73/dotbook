// This device's hybrid logical clock, persisted in `messages_clock`.
//
// @actual-app/crdt keeps ONE clock in a module-global slot (`setClock` /
// `getClock`), and `Timestamp.send()` / `Timestamp.recv()` read it from there.
// A process may hold several databases — the server opens one per user — so
// the slot is shared: two writes interleaving at an await would stamp or count
// one database's messages in the other's clock. Every use of the clock
// therefore runs inside `withClock(db, fn)`: one at a time, process-wide, with
// the slot loaded for `db` first. Never nest it — the inner call would wait on
// the outer forever.

import {
	deserializeClock,
	getClock,
	makeClientId,
	makeClock,
	merkle,
	serializeClock,
	setClock,
	Timestamp,
} from "@actual-app/crdt"

let activeDb = null
let turn = Promise.resolve()

/**
 * Run `fn(clock)` with the slot holding `db`'s clock, after every earlier use
 * has finished, however it finished.
 * @template T
 * @param {import("./index.js").SyncDb} db
 * @param {(clock: object) => Promise<T> | T} fn
 * @returns {Promise<T>}
 */
export function withClock(db, fn) {
	const run = turn.then(async () => fn(await load(db)))
	turn = run.catch(() => undefined)
	return run
}

/** Persist the slot's clock — inside withClock, after anything that moved it. */
export async function saveClock(db) {
	await db.run("UPDATE messages_clock SET clock = ? WHERE id = 1", [serializeClock(getClock())])
}

/**
 * Inside withClock: load the committed clock again. A transaction that rolled
 * back may have moved the clock in memory — counted its messages in the trie —
 * and those messages no longer exist; saved later, that trie would claim them
 * forever.
 */
export async function reloadClock(db) {
	activeDb = null
	return load(db)
}

/**
 * Rebuild the trie from the messages this device actually holds. A trie that
 * counts a message no table has (or misses one it has) can never agree with
 * the server's; this makes it true again.
 */
export function rebuildTrie(db) {
	return withClock(db, async (clock) => {
		let trie = {}
		for (const { timestamp } of await db.all("SELECT timestamp FROM messages_crdt ORDER BY timestamp")) {
			trie = merkle.insert(trie, Timestamp.parse(timestamp))
		}
		clock.merkle = trie
		await saveClock(db)
	})
}

async function load(db) {
	if (db !== activeDb) {
		setClock(await loadOrCreate(db))
		activeDb = db
	}
	return getClock()
}

async function loadOrCreate(db) {
	const row = await db.get("SELECT clock FROM messages_clock WHERE id = 1")
	if (row) {
		return deserializeClock(row.clock)
	}
	// A fresh device: a random 16-hex node id, and time zero so the first send
	// takes the physical time.
	const clock = makeClock(new Timestamp(0, 0, makeClientId()))
	await db.run("INSERT INTO messages_clock (id, clock) VALUES (1, ?)", [serializeClock(clock)])
	return clock
}
