import {
	checkForPermission,
	queryAndAggregateUsageStats,
	queryEvents,
	showUsageAccessSettings,
} from "@justdice/react-native-usage-stats"

// Android's UsageStatsManager, reduced to the three calls this app needs.
// `usage.web.js` is the browser's version of this file (Metro picks it by
// platform): no permission, no apps.
//
// Time comes from EVENTS, not from `queryUsageStats` buckets: a daily bucket is
// cut by the system, not by our local midnight, and a range that touches two
// buckets counts the overlap twice. Events are exact instants, so the sum is
// exactly the seconds each app was in front, inside [startMs, endMs).

// UsageEvents.Event constants. RESUMED/PAUSED (API 29+) share their values with
// the older MOVE_TO_FOREGROUND/MOVE_TO_BACKGROUND, so one pair covers both.
const RESUMED = 1
const PAUSED = 2
const SCREEN_OFF = 16
const ACTIVITY_STOPPED = 23
const SHUTDOWN = 26

// The explicit grant lives on its own settings screen (V0.1 open item 4).
export const hasPermission = checkForPermission

export function openSettings() {
	showUsageAccessSettings("")
}

/**
 * Seconds each app was in the foreground inside [startMs, endMs).
 * @returns {Promise<{ packageName: string, label: string, seconds: number }[]>}
 */
export async function queryDay(startMs, endMs) {
	const events = await queryEvents(startMs, endMs)
	const labels = await labelsFor(startMs, endMs)
	const totals = foregroundMs(events, endMs)
	return Object.entries(totals)
		.map(([packageName, ms]) => ({
			packageName,
			label: labels[packageName] ?? packageName,
			seconds: Math.round(ms / 1000),
		}))
		.filter((app) => app.seconds > 0)
}

// Walk the events in order: RESUMED opens an app's interval, PAUSED closes it.
// Screen off and shutdown close everything, because an app that was in front
// when the screen went dark was not being used.
function foregroundMs(events, endMs) {
	const open = {} // packageName → when it came to the front
	const totals = {}
	for (const event of events) {
		if (event.eventType === RESUMED) {
			open[event.packageName] ??= event.timeStamp
		} else if (event.eventType === PAUSED || event.eventType === ACTIVITY_STOPPED) {
			closeApp(open, totals, event.packageName, event.timeStamp)
		} else if (event.eventType === SCREEN_OFF || event.eventType === SHUTDOWN) {
			for (const packageName of Object.keys(open)) closeApp(open, totals, packageName, event.timeStamp)
		}
	}
	// Still in front at the end of the window (for today: right now).
	for (const packageName of Object.keys(open)) closeApp(open, totals, packageName, endMs)
	return totals
}

function closeApp(open, totals, packageName, at) {
	if (open[packageName] === undefined) return
	totals[packageName] = (totals[packageName] ?? 0) + Math.max(0, at - open[packageName])
	delete open[packageName]
}

// The app names the launcher shows, keyed by package. The aggregate call is used
// only for its labels; its times are the bucket totals this file avoids.
async function labelsFor(startMs, endMs) {
	const labels = {}
	for (const app of await queryAndAggregateUsageStats(startMs, endMs)) labels[app.packageName] = app.appName
	return labels
}
