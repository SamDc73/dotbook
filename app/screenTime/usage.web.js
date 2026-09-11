// The browser has no UsageStatsManager. Same surface as usage.js, no data.
export function hasPermission() {
	return Promise.resolve(false)
}

export function openSettings() {
	// nothing to open
}

export function queryDay() {
	return Promise.resolve([])
}
