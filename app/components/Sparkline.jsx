import { View } from "react-native"
import { format } from "../db/analysis"
import { Text } from "./ui/Text"

// One series as bars, drawn with Views like the habit strip — no chart library.
// A null day is an empty column: a gap, not a zero bar, because "no observation"
// and "zero" are different facts and the gap keeps every day in its place.
export function Sparkline({ series }) {
	const { label, bars, days, format: kind } = series
	// A habit's 7-day average can be all null while its days are not (fewer than
	// seven observed yet): the columns stay empty and the stats line says so.
	const present = bars.filter((value) => value !== null)
	const max = present.length === 0 ? null : Math.max(...present)
	const min = present.length === 0 ? null : Math.min(...present)
	const last = present.at(-1) ?? null

	return (
		<View className="gap-2xs px-md py-xs">
			<Text variant="label">{label}</Text>
			<View className="h-2xl flex-row items-end gap-3xs">
				{bars.map((value, i) => (
					<Bar key={days[i]} value={value} max={max} />
				))}
			</View>
			<Text variant="caption" className="text-on-surface-variant">
				min {format(kind, min)} · max {format(kind, max)} · last {format(kind, last)}
			</Text>
		</View>
	)
}

function Bar({ value, max }) {
	if (value === null || max === null) {
		return <View className="flex-1" />
	}
	// The bar's height is the value as a share of the window's maximum — the one
	// computed layout value here; everything else is a token.
	const percent = max === 0 ? 0 : (value / max) * 100
	return <View className="flex-1 rounded-xs bg-primary" style={{ height: `${percent}%` }} />
}
