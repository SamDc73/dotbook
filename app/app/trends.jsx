import { MIN_PAIRS } from "@dotbook/core/analysis"
import { useRouter } from "expo-router"
import { useSQLiteContext } from "expo-sqlite"
import ChevronLeft from "lucide-react-native/icons/chevron-left"
import { useState } from "react"
import { Pressable, ScrollView, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Sparkline } from "../components/Sparkline"
import { StatRow } from "../components/StatRow"
import { Badge } from "../components/ui/Badge"
import { Icon } from "../components/ui/Icon"
import { Text } from "../components/ui/Text"
import { comparisonRows, correlationRows, days, seriesFor, windowRows } from "../db/analysis"
import { useLiveQuery } from "../db/use-live-query"
import { shiftDay, today } from "../lib/day"

const WINDOWS = [30, 90]

// Trends, correlations, and with-vs-without over the last 30 or 90 days.
// Everything shown is descriptive: things that moved together, with the
// sample size beside them. V0.1 defers causal analysis on purpose.
export default function Trends() {
	const db = useSQLiteContext()
	const router = useRouter()
	const insets = useSafeAreaInsets()
	const [window, setWindow] = useState(WINDOWS[0])

	const end = today()
	const start = shiftDay(end, 1 - window)
	const rows = useLiveQuery(["trends", start, end], () => windowRows(db, start, end))

	const series = seriesFor(rows, days(start, end))
	const pairs = correlationRows(series)
	const comparisons = comparisonRows(series)

	function back() {
		router.back()
	}

	return (
		<View className="flex-1 bg-background" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
			<View className="flex-row items-center gap-sm bg-surface px-md py-sm">
				<Pressable onPress={back} className="rounded-md p-xs active:bg-surface-container" accessibilityLabel="Back">
					<Icon as={ChevronLeft} className="text-on-surface-variant" />
				</Pressable>
				<Text variant="subheading">Trends</Text>
				<View className="ml-auto flex-row gap-xs">
					{WINDOWS.map((option) => (
						<Badge
							key={option}
							variant={option === window ? "primary" : "plain"}
							onPress={() => setWindow(option)}
							accessibilityLabel={`Last ${option} days`}
						>
							{option}
						</Badge>
					))}
				</View>
			</View>

			<ScrollView contentContainerClassName="gap-md py-sm">
				<View>
					{series.map((one) => (
						<Sparkline key={one.name} series={one} />
					))}
				</View>

				<View>
					<Text variant="subheading" className="px-md">
						Correlations
					</Text>
					<Text variant="caption" className="px-md text-on-surface-variant">
						moved together, not caused
					</Text>
					{pairs.length === 0 ? (
						<Text className="px-md py-2xs text-on-surface-variant">needs {MIN_PAIRS} overlapping days</Text>
					) : null}
					{pairs.map((pair) => (
						<StatRow key={`${pair.a}|${pair.b}`} label={`${pair.a} ↔ ${pair.b}`} value={correlationLabel(pair)} />
					))}
				</View>

				{comparisons.length > 0 ? (
					<View>
						<Text variant="subheading" className="px-md">
							With vs without
						</Text>
						{comparisons.map((row) => (
							<StatRow
								key={`${row.habit}|${row.measure}`}
								label={`${row.habit} → ${row.measure} ${change(row.change)}`}
								value={`${row.nWith} vs ${row.nWithout} days`}
							/>
						))}
					</View>
				) : null}
			</ScrollView>
		</View>
	)
}

// `r −0.42 · n 31`, plus the lag when a shift of a few days is clearly stronger.
function correlationLabel({ r, n, best }) {
	let text = `r ${r.toFixed(2)} · n ${n}`
	if (best.lag !== 0 && best.r !== null && Math.abs(best.r) > Math.abs(r)) {
		const distance = Math.abs(best.lag)
		const unit = distance === 1 ? "day" : "days"
		const direction = best.lag > 0 ? "later" : "earlier"
		text += ` (strongest ${distance} ${unit} ${direction})`
	}
	return text
}

// A fraction as a signed percentage: 0.12 → +12%.
function change(fraction) {
	const percent = Math.round(fraction * 100)
	return percent >= 0 ? `+${percent}%` : `${percent}%`
}
