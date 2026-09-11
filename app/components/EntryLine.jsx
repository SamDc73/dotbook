import { localDay, parseLineTime } from "@dotbook/core/parse"
import { useState } from "react"
import { Pressable, Text, View } from "react-native"
import { TemplateExpansion } from "./TemplateExpansion"
import { TimerLine } from "./TimerLine"

// One log line. The time prefix is the bullet: tinted by the hour it names.
// A templated line carries a version chip; tapping the chip shows what it contained.
// A plan line is dimmer; once its time has passed it asks "did it?".
export function EntryLine({ entry, onPress, onLongPress, onConfirm, onStop }) {
	const { timeText, body } = parseLineTime(entry.text, entry.day)
	const hour = entry.ts_start === null ? null : String(new Date(entry.ts_start).getHours()).padStart(2, "0")
	const [expanded, setExpanded] = useState(false)

	if (entry.kind === "timer") {
		return <TimerLine entry={entry} onStop={onStop} onAbandon={onLongPress} />
	}

	const isPlan = entry.kind === "plan"

	function press() {
		onPress(entry)
	}
	function longPress() {
		onLongPress(entry)
	}
	function toggle() {
		setExpanded(!expanded)
	}
	function confirm() {
		onConfirm(entry)
	}

	return (
		<View>
			<Pressable
				onPress={press}
				onLongPress={longPress}
				className="flex-row items-start gap-sm px-md py-xs active:bg-surface-container"
			>
				{timeText !== "" && <Text className={`text-body font-mono text-hour-${hour}`}>{timeText}</Text>}
				<Text className={isPlan ? "flex-1 text-body text-on-surface-variant" : "flex-1 text-body text-on-surface"}>
					{body}
				</Text>
				{isPlan && hasPassed(entry) ? (
					<Pressable onPress={confirm} className="rounded-sm bg-warning-container px-2xs">
						<Text className="text-label text-on-warning-container">did it?</Text>
					</Pressable>
				) : null}
				{entry.template_name !== null && (
					<Pressable onPress={toggle} className="rounded-sm bg-primary-container px-2xs">
						<Text className="text-label text-primary">
							{entry.template_name} v{entry.version_label}
						</Text>
					</Pressable>
				)}
			</Pressable>
			{expanded ? <TemplateExpansion entry={entry} /> : null}
		</View>
	)
}

// A plan's moment is its end for a range, its start otherwise; an untimed plan
// has passed once its day has.
function hasPassed(entry) {
	const now = Date.now()
	const moment = entry.ts_end ?? entry.ts_start
	if (moment !== null) return moment < now
	return entry.day < localDay(now)
}
