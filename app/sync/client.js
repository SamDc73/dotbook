import Storage from "expo-sqlite/kv-store"
import { reannotate } from "../db/entries"
import { adapterFor } from "../db/sync"
import { reconcile } from "../notifications/reminders"
import { runRound } from "./round"

// The sync client: settings from kv-store (written by a login, account.js),
// one fetch as the transport, and the bookkeeping a round leaves behind. Never
// throws — the UI reads the outcome from kv-store, and a failed sync is a
// status line, not an error screen.

export const SETTINGS = { url: "server-url", token: "server-token", group: "group-id", name: "user-name" }
export const STATUS = { lastSync: "last-sync", lastError: "last-sync-error" }

export async function settings() {
	const [url, token, group] = await Promise.all([
		Storage.getItemAsync(SETTINGS.url),
		Storage.getItemAsync(SETTINGS.token),
		Storage.getItemAsync(SETTINGS.group),
	])
	return { url: (url ?? "").trim().replace(/\/+$/, ""), token: token ?? "", groupId: group ?? "" }
}

// One sync at a time: a second call while one runs joins it. The flag also
// lets the change listener ignore the rows a round itself writes.
let inFlight = null

export function isSyncing() {
	return inFlight !== null
}

export function syncNow(db) {
	if (inFlight === null) {
		inFlight = run(db).finally(() => {
			inFlight = null
		})
	}
	return inFlight
}

async function run(db) {
	const { url, token, groupId } = await settings()
	// Not logged in: nothing to sync with, and that is fine.
	if (url === "" || token === "" || groupId === "") {
		return { skipped: true }
	}

	async function post(body) {
		const response = await fetch(`${url}/api/v1/sync`, {
			method: "POST",
			headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
			body: JSON.stringify(body),
		})
		if (!response.ok) {
			throw new Error(`server answered ${response.status}`)
		}
		return response.json()
	}

	try {
		const result = await runRound(adapterFor(db), groupId, post)
		// Foreign lines carry their template use already (it syncs); only the
		// derived items cache is local, so only that is rebuilt.
		await reannotate(db, result.entryIds)
		// A reminder, an answer, or a plan line's time may have changed: rebuild the alarms.
		if (["reminders", "reminder_answers", "entries"].some((dataset) => result.datasets.has(dataset))) {
			await reconcile(db)
		}
		await Storage.setItemAsync(STATUS.lastSync, String(Date.now()))
		await Storage.removeItemAsync(STATUS.lastError)
		return result
	} catch (error) {
		await Storage.setItemAsync(STATUS.lastError, error.message)
		return { error: error.message }
	}
}
