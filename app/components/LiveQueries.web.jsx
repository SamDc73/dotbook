// app/components/LiveQueries.web.jsx
// Web version of LiveQueries: polls server state and invalidates queries on version change.

import { useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"
import { api, hasSession } from "@/lib/api"
import { setOnChange } from "@/lib/changes"
import { reconcile } from "../notifications/reminders"

export default function LiveQueriesWeb() {
	const queryClient = useQueryClient()

	useEffect(() => {
		let currentVersion = null
		const fetchVersion = async () => {
			// On the login screen there is nothing to poll.
			if (!(await hasSession())) return
			try {
				const data = await api("/api/v1/state")
				// Expect a `version` field; fall back to full payload JSON string.
				const version = data?.version ?? JSON.stringify(data)
				if (currentVersion !== null && currentVersion !== version) {
					queryClient.invalidateQueries()
					// Fresh rows may mean fresh reminder times (tab-open notifications).
					reconcile(null)
				}
				currentVersion = version
			} catch {
				// Silently ignore fetch errors.
			}
		}

		// Initial fetch and interval.
		fetchVersion()
		const interval = setInterval(fetchVersion, 10_000)
		const onFocus = () => fetchVersion()
		window.addEventListener("focus", onFocus)

		// Hook for any manual change notification: this tab's own writes.
		setOnChange(() => {
			queryClient.invalidateQueries()
			reconcile(null)
		})

		return () => {
			clearInterval(interval)
			window.removeEventListener("focus", onFocus)
		}
	}, [queryClient])

	return null
}
