import { parseLineTime } from "@dotbook/core/parse"
import { Pressable, Text } from "react-native"

// One log line. The time prefix is the bullet: tinted by the hour it names.
export function EntryLine({ entry, onPress, onLongPress }) {
	const { timeText, body } = parseLineTime(entry.text, entry.day)
	const hour = entry.ts_start === null ? null : String(new Date(entry.ts_start).getHours()).padStart(2, "0")

	function press() {
		onPress(entry)
	}
	function longPress() {
		onLongPress(entry)
	}

	return (
		<Pressable
			onPress={press}
			onLongPress={longPress}
			className="flex-row gap-sm px-md py-xs active:bg-surface-container"
		>
			{timeText !== "" && <Text className={`text-body font-mono text-hour-${hour}`}>{timeText}</Text>}
			<Text className="flex-1 text-body text-on-surface">{body}</Text>
		</Pressable>
	)
}
