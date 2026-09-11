import { localDay, parseLineTime } from "@dotbook/core/parse"
import { useSQLiteContext } from "expo-sqlite"
import Bell from "lucide-react-native/icons/bell"
import BellRing from "lucide-react-native/icons/bell-ring"
import { memo, useState } from "react"
import { Pressable, Text, View } from "react-native"
import { entryReminder, toggleEntryReminder } from "../db/reminders"
import { useLiveQuery } from "../db/use-live-query"
import { reconcile } from "../notifications/reminders"
import { TemplateExpansion } from "./TemplateExpansion"
import { TimerLine } from "./TimerLine"
import { Badge } from "./ui/Badge"
import { Icon } from "./ui/Icon"

// One log line. The time prefix is the bullet: tinted by the hour it names.
// A templated line carries a version chip; tapping the chip shows what it contained.
// A plan line is dimmer; once its time has passed it asks "did it?". While its
// mark is still ahead, a bell adds or removes a reminder at that mark.
//
// Memoised: the log is a list and a timer row redraws every second — only the
// row whose entry changed should render again.
export const EntryLine = memo(function EntryLine({ entry, onPress, onLongPress, onConfirm, onStop }) {
	const db = useSQLiteContext()
	const { timeText, body } = parseLineTime(entry.text, entry.day)
	const hour = entry.ts_start === null ? null : String(new Date(entry.ts_start).getHours()).padStart(2, "0")
	const [expanded, setExpanded] = useState(false)

	const isPlan = entry.kind === "plan"
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
				className="flex-row items-start gap-sm px-md py-xs active:bg-surface-container"
			>
				{timeText !== "" ? <Text className={`text-body font-mono text-hour-${hour}`}>{timeText}</Text> : null}
				<Text className={isPlan ? "flex-1 text-body text-on-surface-variant" : "flex-1 text-body text-on-surface"}>
					{body}
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
						{entry.template_name} v{entry.version_label}
					</Badge>
				) : null}
			</Pressable>
			{expanded ? <TemplateExpansion entry={entry} /> : null}
		</View>
	)
})

// A plan's moment is its end for a range, its start otherwise; an untimed plan
// has passed once its day has.
function hasPassed(entry) {
	const now = Date.now()
	const moment = entry.ts_end ?? entry.ts_start
	if (moment !== null) return moment < now
	return entry.day < localDay(now)
}
