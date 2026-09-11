import { addDatabaseChangeListener } from "expo-sqlite"
import { useEffect } from "react"
import { AppState } from "react-native"
import { isSyncing, syncNow } from "./client"

// When to sync: on start, on every return to the foreground, and 3 s after the
// last local change settles. Rows a sync round writes itself are ignored (the
// message tables by name, everything else while a round is in flight), so a
// round never schedules the next one. Always fire-and-forget: the UI never waits.

const SETTLE_MS = 3000
const MESSAGE_TABLES = new Set(["messages_crdt", "messages_clock"])

export function useSync(db) {
	useEffect(() => {
		syncNow(db)
		const foreground = AppState.addEventListener("change", (state) => {
			if (state === "active") syncNow(db)
		})

		let settle = null
		const changes = addDatabaseChangeListener(({ tableName }) => {
			if (isSyncing() || MESSAGE_TABLES.has(tableName)) return
			clearTimeout(settle)
			settle = setTimeout(() => syncNow(db), SETTLE_MS)
		})

		return () => {
			foreground.remove()
			changes.remove()
			clearTimeout(settle)
		}
	}, [db])
}
