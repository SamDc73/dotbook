import * as Notifications from "expo-notifications"
import { openDatabaseAsync } from "expo-sqlite"
import * as TaskManager from "expo-task-manager"
import { Platform } from "react-native"
import { answerResponse } from "./respond"

// "Yes" from the shade, app closed. On Android, expo-notifications runs the
// registered background task for a custom action button whenever the app is
// not in the foreground — including when it was killed — by loading this
// bundle headless (ExpoHandlingDelegate.handleNotificationResponse). The task
// opens the same database and writes the line; the app never opens.
//
// Must be defined at module scope of the entry file (index.js), before the
// router loads, or the headless instance has no task to run.

export const RESPONSE_TASK = "reminder-response"

if (Platform.OS !== "web") {
	TaskManager.defineTask(RESPONSE_TASK, async ({ data, error }) => {
		if (error || !data || !("actionIdentifier" in data)) return
		const db = await openDatabaseAsync("dotbook.db")
		try {
			await answerResponse(db, data)
		} finally {
			await db.closeAsync()
		}
	})
}

export function registerResponseTask() {
	if (Platform.OS === "web") return Promise.resolve()
	return Notifications.registerTaskAsync(RESPONSE_TASK)
}
