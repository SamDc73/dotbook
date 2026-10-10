import { useSyncExternalStore } from "react"
import { AppState } from "react-native"
import { today } from "./day"

// Today's date as "YYYY-MM-DD", kept current. A screen left open over midnight,
// or an app resumed the next morning, moves to the new day: the date is
// re-read every minute while something shows it and whenever the app comes back
// to the front. It is a string, so a re-read that finds the same day renders nothing.
//
//   const current = useToday()

const RECHECK_MS = 60 * 1000

function subscribe(onChange) {
	const timer = setInterval(onChange, RECHECK_MS)
	const foreground = AppState.addEventListener("change", (state) => {
		if (state === "active") onChange()
	})
	return () => {
		clearInterval(timer)
		foreground.remove()
	}
}

export function useToday() {
	return useSyncExternalStore(subscribe, today, today)
}
