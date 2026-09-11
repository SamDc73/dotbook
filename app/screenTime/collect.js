import Storage from "expo-sqlite/kv-store"
import { useEffect } from "react"
import { AppState, Platform } from "react-native"
import { replaceRollup } from "../db/screenTime"
import { shiftDay, today } from "../lib/day"
import { hasPermission, queryDay } from "./usage"

// Pulls yesterday and today out of UsageStatsManager into `time_rollups`.
// Yesterday too, because the last collection of a day never runs at midnight.

export const LAST_COLLECTED_KEY = "screen-time-collected-at"
// `time_rollups` keys apps by package; the launcher names live here, in kv-store.
export const LABELS_KEY = "screen-time-labels"

export async function collectDays(db, device) {
	const labels = JSON.parse((await Storage.getItemAsync(LABELS_KEY)) ?? "{}")
	for (const day of [shiftDay(today(), -1), today()]) {
		const [start, end] = dayWindow(day)
		for (const app of await queryDay(start, Math.min(end, Date.now()))) {
			await replaceRollup(db, { day, device, key: app.packageName, seconds: app.seconds })
			labels[app.packageName] = app.label
		}
	}
	await Storage.setItemAsync(LABELS_KEY, JSON.stringify(labels))
	await Storage.setItemAsync(LAST_COLLECTED_KEY, String(Date.now()))
}

// Runs a collection on start and on every return to the foreground, when
// permission is granted. Mounted once, from the root layout.
export function useCollectScreenTime(db, device) {
	useEffect(() => {
		if (Platform.OS !== "android") return
		const run = () => hasPermission().then((granted) => granted && collectDays(db, device))
		run()
		const foreground = AppState.addEventListener("change", (state) => state === "active" && run())
		return () => foreground.remove()
	}, [db, device])
}

// [local midnight, next local midnight) as epoch ms.
function dayWindow(day) {
	const [year, month, date] = day.split("-").map(Number)
	return [new Date(year, month - 1, date).getTime(), new Date(year, month - 1, date + 1).getTime()]
}
