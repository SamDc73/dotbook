import { parseLineTime } from "@dotbook/core/parse"
import * as Notifications from "expo-notifications"
import { Platform } from "react-native"
import { allReminders, answeredOn } from "../db/reminders"
import { today } from "../lib/day"
import { CATEGORY, CHANNEL } from "./setup"
import { clearAll, notifyAt, requestPermission } from "./web"

// Reconcile, never orchestrate: everything scheduled is thrown away and rebuilt
// from the reminders table. Runs on app start, on every return to the
// foreground, after any reminder change, and after every answered tap. The
// result is a pure function of the rows and the clock, so nothing is scheduled
// twice and nothing lingers after its row is deleted.
//
// T1 is a daily alarm. T2 is a one-off, `escalation_min` after T1, and is only
// scheduled when nothing was answered that day — that is how answering T1
// cancels T2 without any background code watching for it.

const WEB = Platform.OS === "web"
const MINUTE_MS = 60 * 1000

export async function reconcile(db) {
	await cancelAll()
	const day = today()
	for (const reminder of await allReminders(db)) {
		if (reminder.template_id !== null) {
			await scheduleTemplate(db, reminder, day)
		} else {
			await scheduleEntry(reminder)
		}
	}
}

// Browsers only grant from a click; Android asks whenever. Called from the form's Save.
export function ensurePermission() {
	if (WEB) return requestPermission()
	return Notifications.requestPermissionsAsync().then((status) => status.granted)
}

async function scheduleTemplate(db, reminder, day) {
	const [hour, minute] = reminder.at.split(":").map(Number)
	const channelId = CHANNEL[reminder.style]
	const content = {
		title: `${reminder.template_name}?`,
		body: `Tap Yes to log "took ${reminder.template_name}"`,
		categoryIdentifier: CATEGORY,
		data: { reminderId: reminder.id, log: `took ${reminder.template_name}`, channelId },
	}

	await scheduleDaily(`t1:${reminder.id}`, content, hour, minute, channelId, day)

	if (reminder.escalation_min === null || (await answeredOn(db, reminder.id, day))) return
	let at = timeOn(day, hour, minute) + reminder.escalation_min * MINUTE_MS
	if (at < Date.now()) at += 24 * 60 * MINUTE_MS // today's T2 is gone; tomorrow's is re-checked at the next reconcile
	await scheduleAt(`t2:${reminder.id}`, content, at, channelId)
}

// A plan block's mark: "it's X time", answered from the shade like any reminder.
async function scheduleEntry(reminder) {
	if (reminder.entry_ts === null || reminder.entry_ts < Date.now()) return
	const { body } = parseLineTime(reminder.entry_text, reminder.entry_day)
	const channelId = CHANNEL[reminder.style]
	const content = {
		title: `it's ${body} time`,
		body: "Tap Yes to log it",
		categoryIdentifier: CATEGORY,
		data: { reminderId: reminder.id, log: body, channelId },
	}
	await scheduleAt(`entry:${reminder.id}`, content, reminder.entry_ts, channelId)
}

// The only place Android and the browser differ: the browser gets a timer for
// the next fire within 24 hours, re-armed by the next reconcile.

function cancelAll() {
	if (WEB) return clearAll()
	return Notifications.cancelAllScheduledNotificationsAsync()
}

function scheduleDaily(identifier, content, hour, minute, channelId, day) {
	if (WEB) {
		let at = timeOn(day, hour, minute)
		if (at < Date.now()) at += 24 * 60 * MINUTE_MS
		return notifyAt(at, content.title, content.body)
	}
	return Notifications.scheduleNotificationAsync({
		identifier,
		content,
		trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId },
	})
}

function scheduleAt(identifier, content, at, channelId) {
	if (WEB) return notifyAt(at, content.title, content.body)
	return Notifications.scheduleNotificationAsync({
		identifier,
		content,
		trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId },
	})
}

// Epoch ms of `hour:minute` on local calendar `day`.
function timeOn(day, hour, minute) {
	const [year, month, date] = day.split("-").map(Number)
	return new Date(year, month - 1, date, hour, minute).getTime()
}
