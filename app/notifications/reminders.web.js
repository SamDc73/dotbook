// Web twin of notifications/reminders.js: provides a reconcile function for the web client.
// It fetches upcoming reminder plans from the server and schedules notifications
// using the web Notification API via the primitives in notifications/web.js.

import { api } from "../lib/api"
import { clearAll, notifyAt } from "./web"

/**
 * Reconcile reminders on web.
 * The `db` argument is accepted for API compatibility but ignored – the server
 * holds the authoritative rows.
 */
export async function reconcile(_db) {
	// Clear any existing timers/notifications.
	clearAll()

	const now = Date.now()
	const to = now + 24 * 60 * 60 * 1000 // +24h
	try {
		const data = await api(`/api/v1/reminders/plan?from=${now}&to=${to}`)
		const reminders = data?.reminders ?? []
		for (const r of reminders) {
			// Expect each reminder to have `at` (epoch ms), `title`, and `body` fields.
			const at = r.at
			const title = r.title ?? "Reminder"
			const body = r.body ?? ""
			if (typeof at === "number") {
				notifyAt(at, title, body)
			}
		}
	} catch {
		// Silently ignore errors – the app will retry on focus or other triggers.
	}
}
