import { localDay, parseLineTime } from "@dotbook/core/parse"
import { useSQLiteContext } from "expo-sqlite"
import Bell from "lucide-react-native/icons/bell"
import BellRing from "lucide-react-native/icons/bell-ring"
import { memo, useState } from "react"
import { Pressable, View } from "react-native"
import { entryReminder, toggleEntryReminder } from "../db/reminders"
import { useLiveQuery } from "../db/use-live-query"
import { reconcile } from "../notifications/reminders"
import { TemplateExpansion } from "./TemplateExpansion"
import { TimePill } from "./TimePill"
import { TimerLine } from "./TimerLine"
import { DoneLine } from "./TodoLine"
import { Badge } from "./ui/Badge"
import { Icon } from "./ui/Icon"
import { Text } from "./ui/Text"

// One log line, as the template draws it: the time is the bullet, the text
// follows at baseline, anything in brackets is an aside and reads muted. A line
// that arrived without being typed — ring, screen time — is passive: a diamond
// where the time would be, in the tertiary colour. A templated line carries a
// version chip; tapping it shows what the line contained. A plan line is dimmer;
// once its time has passed it asks "did it?", and while its mark is still ahead
// a bell adds or removes a reminder at that mark.
//
// Memoised: the log is a list and a timer row redraws every second — only the
// row whose entry changed should render again.
export const EntryLine = memo(function EntryLine({ entry, onPress, onLongPress, onConfirm, onStop }) {
	const db = useSQLiteContext()
	const { body } = parseLineTime(entry.text, entry.day)
	const hour = hourOf(entry.ts_start)
	const endHour = hourOf(entry.ts_end)
	const [expanded, setExpanded] = useState(false)

	const isPlan = entry.kind === "plan"
	const passive = PASSIVE.has(entry.source)
	const canRemind = isPlan && entry.ts_start !== null && entry.ts_start > Date.now()
	const reminders = useLiveQuery(
		["entry-reminder", entry.id],
		() => entryReminder(db, entry.id).then((row) => (row ? [row] : [])),
		{ enabled: canRemind }
	)
	const hasReminder = reminders.length > 0

	if (entry.kind === "timer") {
		return <TimerLine entry={entry} onStop={onStop} onAbandon={onLongPress} />
	}
	// A todo's own line — written by the app, or typed in so many words
	// ("anki deck done") and linked to it: its box, struck when it closed it.
	if (entry.source === "todo" || entry.todo_role) {
		return <DoneLine entry={entry} hour={hour} endHour={endHour} />
	}

	function press() {
		onPress(entry)
	}
	function longPress() {
		onLongPress(entry)
	}
	function toggle() {
		setExpanded((open) => !open)
	}
	function confirm() {
		onConfirm(entry)
	}
	async function bell() {
		await toggleEntryReminder(db, entry)
		await reconcile(db)
	}

	return (
		<View>
			<Pressable
				onPress={press}
				onLongPress={longPress}
				className="flex-row items-baseline gap-sm py-xs active:bg-surface-container"
			>
				{passive ? (
					<Text variant="mono" className="text-tertiary">
						◇
					</Text>
				) : null}
				{!passive && entry.ts_start !== null ? (
					<TimePill tsStart={entry.ts_start} tsEnd={entry.ts_end} hour={hour} endHour={endHour} />
				) : null}
				<Text variant="line" className={bodyClass(isPlan, passive)}>
					{segments(body).map((part) => (
						<Text
							key={part.at}
							variant="line"
							className={part.muted || passive ? "text-on-surface-variant" : undefined}
						>
							{part.text}
						</Text>
					))}
				</Text>
				{isPlan && hasPassed(entry) ? (
					<Badge variant="warning" onPress={confirm}>
						did it?
					</Badge>
				) : null}
				{canRemind ? (
					<Pressable onPress={bell} accessibilityLabel={hasReminder ? "Remove reminder" : "Remind me at this time"}>
						<Icon as={hasReminder ? BellRing : Bell} className={hasReminder ? "text-primary" : "text-outline"} />
					</Pressable>
				) : null}
				{entry.template_name !== null ? (
					<Badge variant="primary" onPress={toggle}>
						{entry.template_name} v{entry.version_label} {expanded ? "▾" : "▸"}
					</Badge>
				) : null}
			</Pressable>
			{expanded ? <TemplateExpansion entry={entry} /> : null}
		</View>
	)
})

// Sources that write lines nobody typed. They read as the machine's voice.
const PASSIVE = new Set(["import:ringconn", "android:usagestats", "ext:firefox"])

function bodyClass(isPlan, passive) {
	if (passive) return "flex-1 text-tertiary"
	if (isPlan) return "flex-1 text-on-surface-variant"
	return "flex-1"
}

// `breakfast ready (did some cleaning) — 3 eggs` → the bracketed part is an
// aside. Each piece remembers where it started, which is what keys it.
function segments(body) {
	const parts = []
	let at = 0
	for (const text of body.split(/(\([^)]*\))/)) {
		if (text !== "") parts.push({ at, text, muted: text.startsWith("(") })
		at += text.length
	}
	return parts
}

// A plan's moment is its end for a range, its start otherwise; an untimed plan
// has passed once its day has.
function hasPassed(entry) {
	const now = Date.now()
	const moment = entry.ts_end ?? entry.ts_start
	if (moment !== null) return moment < now
	return entry.day < localDay(now)
}

// The zero-padded local hour an instant falls in — the key of its tint token.
function hourOf(ts) {
	if (ts === null) return null
	return String(new Date(ts).getHours()).padStart(2, "0")
}
