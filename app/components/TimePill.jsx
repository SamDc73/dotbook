import { View } from "react-native"
import { clock, rangeParts } from "../lib/format"
import { Text } from "./ui/Text"

// The time is the bullet, and this is its body. Plex Mono, tabular, so a
// column of times lines up; the field and the digits take the hour's own
// tokens — `bg-hour-07-pill`, `text-hour-07-on-pill` — and tokens.css decides
// what those are: in light they are "Wash" (a faint field of the tint, digits
// in the tint), in dark "Stamp" (the tint as the field, digits in the ground).
// Nothing here knows which theme is on.
//
// The digits come from the row's instants, not from the typed text, so a line
// typed as `13:05` reads `1:05 pm` and one typed as `7:36` reads `7:36 am`;
// the stored text is untouched. A range keeps the start hour's field and each
// time is coloured by its own hour, so in light the day's drift shows inside
// one pill. Never a semantic colour: a time can never be misread as a state.
export function TimePill({ tsStart, tsEnd = null, hour, endHour }) {
	if (tsEnd === null) {
		return (
			<View className={`flex-row items-center gap-2xs rounded-sm px-xs py-3xs bg-hour-${hour}-pill`}>
				<Text variant="mono" className={`text-hour-${hour}-on-pill`}>
					{clock(tsStart)}
				</Text>
			</View>
		)
	}
	const { start, end } = rangeParts(tsStart, tsEnd)
	return (
		<View className={`flex-row items-center gap-2xs rounded-sm px-xs py-3xs bg-hour-${hour}-pill`}>
			<Text variant="mono" className={`text-hour-${hour}-on-pill`}>
				{start}
			</Text>
			<Text variant="mono" className={`text-hour-${hour}-on-pill opacity-60`}>
				→
			</Text>
			<Text variant="mono" className={`text-hour-${endHour ?? hour}-on-pill`}>
				{end}
			</Text>
		</View>
	)
}
