import { View } from "react-native"
import { clock, countdown, dateLabel } from "../lib/format"
import { Text } from "./ui/Text"

// The focus view's centre: the block is the track. Everything here is derived
// from `current` and `now` — nothing is stored, so a timer started on another
// device draws the same bar. Type follows the template: mono for every figure,
// Fraunces for the one title.
export function Scrubber({ current, next, now }) {
	return (
		<View className="flex-1 justify-center gap-lg px-lg">
			<View className="flex-row justify-between">
				<Text variant="mono" className="text-on-surface-variant">
					{clock(now)}
				</Text>
				<Text variant="mono" className="text-on-surface-variant">
					{dateLabel(now)}
				</Text>
			</View>

			{current !== null ? <Countdown current={current} now={now} /> : null}

			{next !== null ? (
				<View className="flex-row items-baseline gap-md border-t border-outline-variant pt-md">
					<Text variant="eyebrow">up next</Text>
					<Text variant="mono" className="text-on-surface-variant">
						{clock(next.ts_start)}
					</Text>
					<Text variant="line">{next.title}</Text>
				</View>
			) : null}
		</View>
	)
}

function Countdown({ current, now }) {
	const remaining = Math.max(0, current.ts_end - now)
	const elapsed = now - current.ts_start
	const fraction = Math.min(1, Math.max(0, elapsed / (current.ts_end - current.ts_start)))

	return (
		<View className="gap-sm">
			<Text variant="heading">{current.title}</Text>
			<Text className="font-mono text-display1 tabular-nums">{countdown(remaining)}</Text>

			<View className="h-2xs rounded-xl bg-outline-variant">
				{/* The fill's width is the elapsed fraction — the one computed layout value here. */}
				<View
					className="h-2xs flex-row items-center justify-end rounded-xl bg-primary"
					style={{ width: `${fraction * 100}%` }}
				>
					<View className="h-sm w-sm rounded-xl bg-primary" />
				</View>
			</View>

			<View className="flex-row justify-between">
				<Text variant="mono" className="text-on-surface-variant">
					{clock(current.ts_start)}
				</Text>
				<Text variant="mono" className="text-on-surface-variant">
					−{countdown(remaining)}
				</Text>
			</View>
		</View>
	)
}
