import { api } from "../lib/api"

// Web twin of db/screenTime.js. The rows live on the server; the `db`
// parameter is accepted and ignored.

// Everything recorded for one day, from every source and device, most time first.
export async function rollupsOn(_db, day) {
	const data = await api(`/api/v1/screen-time?day=${encodeURIComponent(day)}`)
	return data.rollups
}

// No-op: UsageStats collection is an Android job on this device, and the web
// build has nothing to collect — the server ingests the Firefox extension's
// batches its own way (it ADDS; only this device's authoritative REPLACE is
// local). Kept so the sibling's callers keep working unchanged.
export function replaceRollup(_db, _rollup) {
	return Promise.resolve()
}
