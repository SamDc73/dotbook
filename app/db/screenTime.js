// `time_rollups`: seconds per day, per source, per device, per key. The key is a
// package name for `android:usagestats` and a hostname for `ext:firefox`.

const USAGE_STATS = "android:usagestats"

// UsageStats is authoritative for the whole day, so a collection REPLACES the
// row. The Firefox extension is the opposite: each of its batches covers a few
// minutes it will never send again, so the server ADDS. Same table, two rules,
// because the two sources report differently.
export function replaceRollup(db, { day, device, key, seconds }) {
	return db.sql`INSERT INTO time_rollups (day, source, device, key, seconds)
		VALUES (${day}, ${USAGE_STATS}, ${device}, ${key}, ${seconds})
		ON CONFLICT (day, source, device, key) DO UPDATE SET seconds = excluded.seconds`
}

// Everything recorded for one day, from every source and device, most time first.
export function rollupsOn(db, day) {
	return db.sql`SELECT source, device, key, seconds FROM time_rollups
		WHERE day = ${day} ORDER BY seconds DESC`
}
