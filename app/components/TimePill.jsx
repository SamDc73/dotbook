import { View } from "react-native"
import { Text } from "./ui/Text"

// The time is the bullet, and this is its body: "Wash" — the hour's own tint
// as a faint field behind digits in that same tint. Plex Mono, tabular, so a
// column of times lines up. A range keeps the start hour's wash and colours
// each time by its own hour, so the day's drift shows inside one pill.
//
// Colour comes only from the hour tokens (`text-hour-07`, `bg-hour-07-wash`),
// never a semantic colour: a time can never be misread as a habit state.
// The stored text is untouched; `->` is only drawn as an arrow.
const SEPARATOR = /\s*(?:->|→|-|–|—)\s*/

export function TimePill({ timeText, hour, endHour }) {
	const [start, end] = timeText.trim().split(SEPARATOR)
	return (
		<View className={`flex-row items-center gap-2xs rounded-sm px-xs py-3xs bg-hour-${hour}-wash`}>
			<Text variant="mono" className={`text-hour-${hour}`}>
				{start}
			</Text>
			{end ? (
				<Text variant="mono" className="text-on-surface-variant">
					→
				</Text>
			) : null}
			{end ? (
				<Text variant="mono" className={`text-hour-${endHour ?? hour}`}>
					{end}
				</Text>
			) : null}
		</View>
	)
}
