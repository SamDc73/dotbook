import { View } from "react-native"
import { Text } from "./ui/Text"

// The time is the bullet, and this is its body. Plex Mono, tabular, so a
// column of times lines up; the field and the digits take the hour's own
// tokens — `bg-hour-07-pill`, `text-hour-07-on-pill` — and tokens.css decides
// what those are: in light they are "Wash" (a faint field of the tint, digits
// in the tint), in dark "Stamp" (the tint as the field, digits in the ground).
// Nothing here knows which theme is on.
//
// A range keeps the start hour's field; each time is coloured by its own hour,
// so in light the day's drift shows inside one pill. The stored text is
// untouched; `->` is only drawn as an arrow. Never a semantic colour: a time
// can never be misread as a habit state.
const SEPARATOR = /\s*(?:->|→|-|–|—)\s*/

export function TimePill({ timeText, hour, endHour }) {
	const [start, end] = timeText.trim().split(SEPARATOR)
	return (
		<View className={`flex-row items-center gap-2xs rounded-sm px-xs py-3xs bg-hour-${hour}-pill`}>
			<Text variant="mono" className={`text-hour-${hour}-on-pill`}>
				{start}
			</Text>
			{end ? (
				<Text variant="mono" className={`text-hour-${hour}-on-pill opacity-60`}>
					→
				</Text>
			) : null}
			{end ? (
				<Text variant="mono" className={`text-hour-${endHour ?? hour}-on-pill`}>
					{end}
				</Text>
			) : null}
		</View>
	)
}
