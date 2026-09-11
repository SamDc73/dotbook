// This device's hybrid logical clock, persisted in `messages_clock`.
//
// @actual-app/crdt keeps ONE clock in a module-global slot (`setClock` /
// `getClock`), and `Timestamp.send()` / `Timestamp.recv()` read it from there.
// Every function that stamps or applies messages therefore starts with
// `clockFor(db)`, which makes that slot belong to `db`, and ends with
// `saveClock(db)`. In production a process has one database, so the load
// happens once; in tests several databases share a process and swap cleanly.

import {
	deserializeClock,
	getClock,
	makeClientId,
	makeClock,
	serializeClock,
	setClock,
	Timestamp,
} from "@actual-app/crdt"

let activeDb = null

/** The clock for `db`, created on first use. */
export function clockFor(db) {
	if (db !== activeDb) {
		setClock(loadOrCreate(db))
		activeDb = db
	}
	return getClock()
}

/** Persist the global clock — call after anything that moved it. */
export function saveClock(db) {
	db.run("UPDATE messages_clock SET clock = ? WHERE id = 1", [serializeClock(getClock())])
}

function loadOrCreate(db) {
	const row = db.get("SELECT clock FROM messages_clock WHERE id = 1")
	if (row) {
		return deserializeClock(row.clock)
	}
	// A fresh device: a random 16-hex node id, and time zero so the first send
	// takes the physical time.
	const clock = makeClock(new Timestamp(0, 0, makeClientId()))
	db.run("INSERT INTO messages_clock (id, clock) VALUES (1, ?)", [serializeClock(clock)])
	return clock
}
