import * as Notifications from "expo-notifications"
import { Platform } from "react-native"

// One-time notification plumbing for Android. Web has its own path in web.js.
//
// Reboot survival is the library's: expo-notifications ships a BOOT_COMPLETED
// receiver that re-registers every scheduled alarm. Exactness comes from the
// USE_EXACT_ALARM permission in app.json — with it, expo-notifications uses
// AlarmManager.setExactAndAllowWhileIdle, so a 09:00 reminder fires at 09:00,
// Doze or not.

export const CHANNEL = { notify: "reminders", alarm: "alarms" }
export const CATEGORY = "reminder"
export const ACTION = { yes: "yes", notYet: "not_yet", snooze: "snooze" }

// Shown even while the app is open; a reminder is a question, not a badge.
Notifications.setNotificationHandler({
	handleNotification: async () => ({
		shouldShowBanner: true,
		shouldShowList: true,
		shouldPlaySound: true,
		shouldSetBadge: false,
	}),
})

export async function setupNotifications() {
	if (Platform.OS === "web") return

	await Notifications.setNotificationChannelAsync(CHANNEL.notify, {
		name: "Reminders",
		importance: Notifications.AndroidImportance.HIGH,
	})
	// "Alarm-style": as loud as a channel can be. Android offers no full-screen
	// alarm through expo-notifications, so this is the honest maximum.
	await Notifications.setNotificationChannelAsync(CHANNEL.alarm, {
		name: "Alarms",
		importance: Notifications.AndroidImportance.MAX,
		bypassDnd: true,
		lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
		sound: "default",
		vibrationPattern: [0, 800, 400, 800, 400, 800],
	})

	// The three buttons on every reminder. None opens the app: the answer is
	// handled where the tap lands — see respond.js and task.js.
	await Notifications.setNotificationCategoryAsync(CATEGORY, [
		{ identifier: ACTION.yes, buttonTitle: "Yes", options: { opensAppToForeground: false } },
		{ identifier: ACTION.notYet, buttonTitle: "Not yet", options: { opensAppToForeground: false } },
		{ identifier: ACTION.snooze, buttonTitle: "Snooze", options: { opensAppToForeground: false } },
	])

	const { granted } = await Notifications.getPermissionsAsync()
	if (!granted) {
		await Notifications.requestPermissionsAsync()
	}
}
