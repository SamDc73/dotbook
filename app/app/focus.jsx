import { useRouter } from "expo-router"
import { useSQLiteContext } from "expo-sqlite"
import { StatusBar } from "expo-status-bar"
import ChevronLeft from "lucide-react-native/icons/chevron-left"
import { useEffect, useState } from "react"
import { KeyboardAvoidingView, Platform, Pressable, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Scrubber } from "../components/Scrubber"
import { Icon } from "../components/ui/Icon"
import { Input } from "../components/ui/Input"
import { activeCountdown, upNext } from "../db/blocks"
import { addEntry } from "../db/entries"
import { useLiveQuery } from "../db/use-live-query"
import { today } from "../lib/day"
import { tap } from "../lib/haptics"
import { useToday } from "../lib/use-today"

// The focus view: one block, one line. Reached by a button, never the default.
// Nothing written earlier is ever shown here — that is the whole point.
export default function Focus() {
	const db = useSQLiteContext()
	const router = useRouter()
	const insets = useSafeAreaInsets()
	const [now, setNow] = useState(Date.now)
	const [text, setText] = useState("")

	useEffect(() => {
		const tick = setInterval(() => setNow(Date.now()), 1000)
		return () => clearInterval(tick)
	}, [])

	// Which block is active changes only at a boundary, and plan blocks start and
	// end on whole minutes, so the queries take `now` floored to the minute and
	// re-run once a minute. A timer can end mid-minute: it is hidden the second
	// it ends, and whatever block is underneath appears at the next whole minute.
	const minute = Math.floor(now / 60000) * 60000
	const day = useToday()
	const [current = null] = useLiveQuery(["blocks", "current", minute], () => activeCountdown(db, minute))
	const [next = null] = useLiveQuery(["blocks", "next", minute, day], () => upNext(db, minute, day))
	const ended = current !== null && current.ts_end <= now

	function back() {
		router.back()
	}

	function submit() {
		const line = text.trim()
		setText("")
		if (line === "") return
		addEntry(db, { day: today(), text: line })
		tap("logged")
	}

	return (
		<KeyboardAvoidingView
			behavior={Platform.OS === "ios" ? "padding" : "height"}
			className="flex-1 bg-background"
			style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
		>
			<View className="px-sm py-sm">
				<Pressable
					onPress={back}
					className="self-start rounded-full p-xs active:bg-surface-container"
					accessibilityLabel="Back"
				>
					<Icon as={ChevronLeft} className="text-on-surface-variant" />
				</Pressable>
			</View>

			<Scrubber current={ended ? null : current} next={next} now={now} />

			<View className="border-t border-outline-variant px-md py-sm">
				<Input
					className="bg-background"
					value={text}
					onChangeText={setText}
					onSubmitEditing={submit}
					submitBehavior="submit"
					placeholder="type a line…"
					autoFocus
				/>
			</View>
			<StatusBar style="auto" />
		</KeyboardAvoidingView>
	)
}
