import { api } from "../lib/api"
import { noteChange } from "../lib/changes"

// Web twin of db/ringconn.js: RingConn CSV → the observation tables, decided
// on the server (insert, update, or skip — gap-filling, never overwriting).
// The `db` parameter is accepted and ignored.
//
// CONTRACT NOTE: lib/api.js sends JSON bodies, so the CSV travels as the
// body's JSON string and the zone the ring app exported in rides in the query
// string — the server should read the body with req.json() to get the file
// text back, and `tz` for the zone.

/**
 * @param {string} text  the whole file
 * @param {string} tzid  the zone the ring app exported in
 * @returns {Promise<{ kind: "activity"|"sleep"|"vitals"|null, inserted: number, updated: number, skipped: number }>}
 */
export async function importRingconn(_db, text, tzid) {
	const data = await api(`/api/v1/import/ringconn?tz=${encodeURIComponent(tzid)}`, { method: "POST", body: text })
	const added = data.imported ?? data
	noteChange()
	return {
		kind: added.kind ?? null,
		inserted: added.inserted ?? 0,
		updated: added.updated ?? 0,
		skipped: added.skipped ?? 0,
	}
}
