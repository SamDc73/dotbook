import { localDay, parseLineTime } from "@dotbook/core/parse"
import Storage from "expo-sqlite/kv-store"
import { Platform } from "react-native"
import { uuidv7 } from "uuidv7"
import {
	cancelScheduledNotificationAsync,
	SchedulableTriggerInputTypes,
	scheduleNotificationAsync,
} from "../notifications/native"
import { insertRow, updateRow } from "./sync"
import { linkTimerToActiveTodo } from "./todos"

// A timer is a row, not runtime state (AGENTS.md → "Timers are rows"): `kind: timer`
// with ts_start and ts_end. Remaining time is always ts_end − now, so it survives
// an app kill, a reboot, and a sync from another device. The row is written
// through insertRow/updateRow (db/sync.js), which is what makes the last part true.

const MINUTE_MS = 60 * 1000

// A block that starts in under this is not worth a timer; offer the next one.
const TOO_SOON_MS = 2 * MINUTE_MS

export async function startTimer(db, { minutes, text }) {
	const now = Date.now()
	const day = localDay(now)
	const id = uuidv7()
	const tsEnd = now + minutes * MINUTE_MS
	const { next } = await db.sql`SELECT coalesce(max(seq), 0) + 1 AS next FROM entries WHERE day = ${day}`.first()
	await insertRow(db, "entries", {
		id,
		day,
		seq: next,
		ts_start: now,
		ts_end: tsEnd,
		text,
		kind: "timer",
		source: "manual",
		created_at: now,
		deleted_at: null,
	})
	// Working on a todo? Its time is this timer's. See todos.js.
	await linkTimerToActiveTodo(db, id, now)
	await notifyAtEnd(id, tsEnd, minutes)
	return id
}

// Completing writes ts_end as it actually happened.
export async function stopTimer(db, entry) {
	await updateRow(db, "entries", { id: entry.id }, { ts_end: Date.now() })
	await cancelEndNotification(entry.id)
}

// Abandoning is a soft delete, not a silent disappearance.
export async function abandonTimer(db, entry) {
	await updateRow(db, "entries", { id: entry.id }, { deleted_at: Date.now() })
	await cancelEndNotification(entry.id)
}

// The duration is offered, never demanded. Two sources, in order: the plan you
// already wrote, then what you usually do. Each is a chip; typing a number ignores both.
export async function suggestions(db, day, now) {
	const offered = []
	const block = await nextPlanBlock(db, day, now)
	if (block) {
		const minutes = Math.ceil((block.ts_start - now) / MINUTE_MS)
		offered.push({
			minutes,
			label: `${minutes} min — until ${parseLineTime(block.text, block.day).body} at ${clock(block.ts_start)}`,
		})
	}
	const usual = await usualMinutes(db)
	if (usual !== null && usual !== offered[0]?.minutes) {
		offered.push({ minutes: usual, label: `${usual} min — your usual` })
	}
	return offered
}

// The next plan block of the day being viewed. If it starts in under two minutes,
// the one after it — a 90-second timer helps nobody.
async function nextPlanBlock(db, day, now) {
	const blocks = await db.sql`SELECT * FROM entries WHERE day = ${day} AND kind = 'plan' AND deleted_at IS NULL
		AND ts_start > ${now} ORDER BY ts_start LIMIT 2`
	const soon = blocks[0] && blocks[0].ts_start - now < TOO_SOON_MS
	return (soon ? blocks[1] : blocks[0]) ?? null
}

// Your most frequent past timer length, most recent breaking ties. Plain SQL over the log.
async function usualMinutes(db) {
	const row = await db.sql`SELECT round((ts_end - ts_start) / 60000.0) AS minutes FROM entries
		WHERE kind = 'timer' AND deleted_at IS NULL AND ts_end > ts_start
		GROUP BY minutes ORDER BY count(*) DESC, max(created_at) DESC LIMIT 1`.first()
	return row ? Number(row.minutes) : null
}

function clock(epochMs) {
	const at = new Date(epochMs)
	return `${at.getHours()}:${String(at.getMinutes()).padStart(2, "0")}`
}

// End-of-timer notification. Native: expo-notifications, one DATE trigger; the
// scheduled id is kept in kv-store so stopping can cancel it. Web, tab open: a
// plain Notification — no push path here. Permission asking belongs to reminders.
const WEB_TIMEOUTS = new Map()

async function notifyAtEnd(entryId, tsEnd, minutes) {
	const content = { title: "Timer done", body: `${minutes} min` }
	if (Platform.OS === "web") {
		if (typeof Notification === "undefined" || Notification.permission !== "granted") return
		const handle = setTimeout(() => new Notification(content.title, { body: content.body }), tsEnd - Date.now())
		WEB_TIMEOUTS.set(entryId, handle)
		return
	}
	const notificationId = await scheduleNotificationAsync({
		content,
		trigger: { type: SchedulableTriggerInputTypes.DATE, date: tsEnd },
	})
	await Storage.setItemAsync(`timer-notification:${entryId}`, notificationId)
}

async function cancelEndNotification(entryId) {
	if (Platform.OS === "web") {
		clearTimeout(WEB_TIMEOUTS.get(entryId))
		WEB_TIMEOUTS.delete(entryId)
		return
	}
	const notificationId = await Storage.getItemAsync(`timer-notification:${entryId}`)
	if (notificationId === null) return
	await cancelScheduledNotificationAsync(notificationId)
	await Storage.removeItemAsync(`timer-notification:${entryId}`)
}
