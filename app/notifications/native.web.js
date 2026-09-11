// The web stand-in for expo-notifications (see native.js). Nothing here
// schedules anything: the browser path is notifications/web.js, and the
// callers already branch on Platform.OS === "web" before reaching these.
// They exist so the same imports resolve, and so a stray call is a no-op
// rather than an undefined function.

export const DEFAULT_ACTION_IDENTIFIER = "expo.modules.notifications.actions.DEFAULT"
export const SchedulableTriggerInputTypes = { DAILY: "daily", DATE: "date", TIME_INTERVAL: "timeInterval" }
export const AndroidImportance = { HIGH: 4, MAX: 5 }
export const AndroidNotificationVisibility = { PUBLIC: 1 }

const NOT_GRANTED = { granted: false }
const NO_SUBSCRIPTION = { remove: noop }

function noop() {
	return undefined
}
async function noopAsync() {
	return undefined
}

export const setNotificationHandler = noop
export const setNotificationChannelAsync = noopAsync
export const setNotificationCategoryAsync = noopAsync
export const cancelScheduledNotificationAsync = noopAsync
export const cancelAllScheduledNotificationsAsync = noopAsync
export const registerTaskAsync = noopAsync

export async function getPermissionsAsync() {
	return NOT_GRANTED
}
export async function requestPermissionsAsync() {
	return NOT_GRANTED
}
export async function scheduleNotificationAsync() {
	return null
}
export function addNotificationResponseReceivedListener() {
	return NO_SUBSCRIPTION
}
export async function getLastNotificationResponseAsync() {
	return null
}
