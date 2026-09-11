import Square from "lucide-react-native/icons/square"
import { useEffect, useState } from "react"
import { Pressable, View } from "react-native"
import { countdown } from "../lib/format"
import { Icon } from "./ui/Icon"
import { Text } from "./ui/Text"

// A running timer in the log: a live countdown on its own line. Remaining time
// is ts_end − now, recomputed from the row, never held anywhere else.
export function TimerLine({ entry, onStop, onAbandon }) {
	const [now, setNow] = useState(Date.now)
	const running = now < entry.ts_end

	useEffect(() => {
		if (!running) return
		const tick = setInterval(() => setNow(Date.now()), 1000)
		return () => clearInterval(tick)
	}, [running])

	const total = entry.ts_end - entry.ts_start
	const elapsed = Math.min(now, entry.ts_end) - entry.ts_start
	const fraction = total > 0 ? elapsed / total : 1

	function stop() {
		onStop(entry)
	}
	function abandon() {
		onAbandon(entry)
	}

	return (
		<Pressable
			onLongPress={abandon}
			className="relative my-2xs overflow-hidden rounded-seg border border-primary-line bg-surface"
		>
			{/* The progress is a layer behind the line, not inside the text. Its width
			    is the elapsed fraction — a computed layout value, the one style here
			    that is not a token. */}
			<View className="absolute bottom-0 left-0 top-0 bg-primary-wash" style={{ width: `${fraction * 100}%` }} />
			<View className="flex-row items-center gap-sm px-sm py-xs">
				<Text variant="mono" className="text-primary">
					{running ? countdown(entry.ts_end - now) : "done"}
				</Text>
				<Text variant="line" className="flex-1 text-on-surface-variant">
					{entry.text}
				</Text>
				{running ? (
					<Pressable onPress={stop} accessibilityLabel="Stop timer" className="p-2xs">
						<Icon as={Square} className="text-primary" />
					</Pressable>
				) : null}
			</View>
		</Pressable>
	)
}
