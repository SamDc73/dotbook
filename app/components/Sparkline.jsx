import { View } from "react-native"
import { BarChart } from "react-native-gifted-charts"
import { format } from "../db/analysis"
import { useTokenColour } from "../lib/use-token-colour"
import { Text } from "./ui/Text"

// One series as bars, drawn by react-native-gifted-charts. A null day is an
// invisible bar: a gap, not a zero, because "no observation" and "zero" are
// different facts and the gap keeps every day in its place.
//
// The bar colour is the one value that must reach the chart as JavaScript;
// it comes through useTokenColour, the sanctioned live-variable hook.
const HEIGHT = 48
const BAR = 5
const GAP = 2

export function Sparkline({ series }) {
	const { label, bars, format: kind } = series
	const primary = useTokenColour("--color-primary")

	// A habit's 7-day average can be all null while its days are not (fewer than
	// seven observed yet): the chart stays empty and the stats line says so.
	const present = bars.filter((value) => value !== null)
	const max = present.length === 0 ? null : Math.max(...present)
	const min = present.length === 0 ? null : Math.min(...present)
	const last = present.at(-1) ?? null

	const data = bars.map((value) => (value === null ? GAP_BAR : { value, frontColor: primary }))

	return (
		<View className="gap-2xs px-md py-xs">
			<Text variant="label">{label}</Text>
			<BarChart
				data={data}
				height={HEIGHT}
				maxValue={max === null || max === 0 ? 1 : max}
				barWidth={BAR}
				spacing={GAP}
				initialSpacing={0}
				endSpacing={0}
				barBorderRadius={1}
				hideAxesAndRules
				hideYAxisText
				disableScroll
				disablePress
			/>
			<Text variant="caption" className="text-on-surface-variant">
				min {format(kind, min)} · max {format(kind, max)} · last {format(kind, last)}
			</Text>
		</View>
	)
}

const GAP_BAR = { value: 0, frontColor: "transparent" }
