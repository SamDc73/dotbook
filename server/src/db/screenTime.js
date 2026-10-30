// Screen-time rollups the web client reads (app/db/screenTime.js's mirror).

const USAGE_STATS = "android:usagestats"

export function replaceRollup(db, { day, device, key, seconds }) {
	return db.run(
		`INSERT INTO time_rollups (day, source, device, key, seconds) VALUES (?, ?, ?, ?, ?)
		ON CONFLICT (day, source, device, key) DO UPDATE SET seconds = excluded.seconds`,
		[day, USAGE_STATS, device, key, seconds]
	)
}

export function rollupsOn(db, day) {
	return db.all("SELECT source, device, key, seconds FROM time_rollups WHERE day = ? ORDER BY seconds DESC", [day])
}
