import { localDay } from "@dotbook/core/parse"
import * as Notifications from "expo-notifications"
import { addEntry } from "../db/entries"
import { recordAnswer } from "../db/reminders"
import { reconcile } from "./reminders"
import { ACTION, CATEGORY } from "./setup"

// What a tap on a reminder means. Called from two places for the same tap —
// the foreground listener and the headless background task — so the first
// thing it does is claim the tap in `reminder_answers`; the second caller
// finds it claimed and stops.
//
// The line is stamped with the notification's fire time, not the tap time:
// the reminder asked "did you take it at 09:00?", and when a tap is delivered
// late (app killed, no background task) the tap time is not known anyway.

const SNOOZE_MIN = 10

export async function answerResponse(db, response) {
	const { actionIdentifier, notification } = response
	if (actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) return // tapping the body just opens the app

	const content = notification.request.content
	// The background task receives the payload with `data` still JSON text.
	const data = content.data ?? (content.dataString ? JSON.parse(content.dataString) : null)
	if (!data?.reminderId) return // not a reminder

	const firedAt = notification.date
	const day = localDay(firedAt)
	const key = `${notification.request.identifier}@${firedAt}`
	const first = await recordAnswer(db, { reminderId: data.reminderId, day, answer: actionIdentifier, key })
	if (!first) return

	if (actionIdentifier === ACTION.yes) {
		const id = await addEntry(db, { day, text: `${clock(firedAt)} ${data.log}` })
		await db.sql`UPDATE entries SET source = 'reminder' WHERE id = ${id}`
	}
	if (actionIdentifier === ACTION.snooze) {
		await Notifications.scheduleNotificationAsync({
			content: { title: content.title, body: content.body, categoryIdentifier: CATEGORY, data },
			trigger: {
				type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
				seconds: SNOOZE_MIN * 60,
				channelId: data.channelId,
			},
		})
	}
	await reconcile(db)
}

// `9:05`, the way a person types it, so the line parses like any other.
function clock(epochMs) {
	const at = new Date(epochMs)
	return `${at.getHours()}:${String(at.getMinutes()).padStart(2, "0")}`
}
