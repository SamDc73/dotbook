import { View } from "react-native"
import { Text } from "./ui/Text"

// The focus view's centre: the block is the track. Everything here is derived
// from `current` and `now` — nothing is stored, so a timer started on another
// device draws the same bar.
export function Scrubber({ current, next, now }) {
	return (
		<View className="flex-1 justify-center gap-lg px-lg">
			<View className="flex-row justify-between">
				<Text variant="label" className="text-on-surface-variant">
					{clock(now)}
				</Text>
				<Text variant="label" className="text-on-surface-variant">
					{dateLabel(now)}
				</Text>
			</View>

			{current !== null && <Countdown current={current} now={now} />}

			{next !== null && (
				<View className="flex-row gap-md border-t border-outline-variant pt-md">
					<Text variant="label" className="text-on-surface-variant">
						UP NEXT
					</Text>
					<Text variant="label">
						{clock(next.ts_start)} · {next.title}
					</Text>
				</View>
			)}
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
			<Text className="font-mono text-display1">{countdown(remaining)}</Text>

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
				<Text variant="label" className="text-on-surface-variant">
					{clock(current.ts_start)}
				</Text>
				<Text variant="label" className="font-mono text-on-surface-variant">
					−{countdown(remaining)}
				</Text>
			</View>
		</View>
	)
}

/** `18:42`, or `1:03:07` once an hour or more is left. */
function countdown(ms) {
	const totalSeconds = Math.floor(ms / 1000)
	const hours = Math.floor(totalSeconds / 3600)
	const minutes = Math.floor((totalSeconds % 3600) / 60)
	const seconds = totalSeconds % 60
	const mmss = `${hours > 0 ? pad(minutes) : minutes}:${pad(seconds)}`
	return hours > 0 ? `${hours}:${mmss}` : mmss
}

/** `14:21` — 24-hour wall clock. */
function clock(ts) {
	const date = new Date(ts)
	return `${date.getHours()}:${pad(date.getMinutes())}`
}

/** `Tue 9 Sep` */
function dateLabel(ts) {
	return new Date(ts).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })
}

function pad(n) {
	return String(n).padStart(2, "0")
}
