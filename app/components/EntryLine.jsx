import { parseLineTime } from "@dotbook/core/parse"
import { useState } from "react"
import { Pressable, Text, View } from "react-native"
import { TemplateExpansion } from "./TemplateExpansion"

// One log line. The time prefix is the bullet: tinted by the hour it names.
// A templated line carries a version chip; tapping the chip shows what it contained.
export function EntryLine({ entry, onPress, onLongPress }) {
	const { timeText, body } = parseLineTime(entry.text, entry.day)
	const hour = entry.ts_start === null ? null : String(new Date(entry.ts_start).getHours()).padStart(2, "0")
	const [expanded, setExpanded] = useState(false)

	function press() {
		onPress(entry)
	}
	function longPress() {
		onLongPress(entry)
	}
	function toggle() {
		setExpanded(!expanded)
	}

	return (
		<View>
			<Pressable
				onPress={press}
				onLongPress={longPress}
				className="flex-row items-start gap-sm px-md py-xs active:bg-surface-container"
			>
				{timeText !== "" && <Text className={`text-body font-mono text-hour-${hour}`}>{timeText}</Text>}
				<Text className="flex-1 text-body text-on-surface">{body}</Text>
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
