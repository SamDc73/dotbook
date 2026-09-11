import * as Notifications from "expo-notifications"
import { Stack } from "expo-router"
import { SQLiteProvider, useSQLiteContext } from "expo-sqlite"
import { Suspense, useEffect } from "react"
import { ActivityIndicator, AppState, Platform } from "react-native"
import { migrate } from "../db/migrate"
import { reconcile } from "../notifications/reminders"
import { answerResponse } from "../notifications/respond"
import { setupNotifications } from "../notifications/setup"
import { registerResponseTask } from "../notifications/task"
import { MaterialYou } from "../theme/MaterialYou"
import "../global.css"

export default function RootLayout() {
	return (
		<Suspense fallback={<ActivityIndicator className="flex-1 bg-background text-primary" />}>
			<SQLiteProvider
				databaseName="dotbook.db"
				options={{ enableChangeListener: true }}
				onInit={migrate}
				useSuspense
			>
				<Reminders />
				<MaterialYou>
					<Stack screenOptions={{ headerShown: false }} />
				</MaterialYou>
			</SQLiteProvider>
		</Suspense>
	)
}

// Keeps the scheduled alarms equal to the reminders table, and answers taps
// while the app is running. Taps while it is closed are the background task's
// (notifications/task.js); both go through the same answerResponse, which
// claims each tap once, so overlap is harmless.
function Reminders() {
	const db = useSQLiteContext()

	useEffect(() => {
		const foreground = AppState.addEventListener("change", (state) => {
			if (state === "active") reconcile(db)
		})
		if (Platform.OS === "web") {
			reconcile(db)
			return () => foreground.remove()
		}

		setupNotifications()
			.then(registerResponseTask)
			.then(() => reconcile(db))
		const taps = Notifications.addNotificationResponseReceivedListener((response) => answerResponse(db, response))
		// A tap that woke the app before this listener existed is still waiting here.
		Notifications.getLastNotificationResponseAsync().then((response) => response && answerResponse(db, response))
		return () => {
			foreground.remove()
			taps.remove()
		}
	}, [db])

	return null
}
