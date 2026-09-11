import { MarkdownTextInput } from "@expensify/react-native-live-markdown"
import { parseLineTime } from "@dotbook/core/parse"
import { useQuery } from "@tanstack/react-query"
import { useSQLiteContext } from "expo-sqlite"
import { styled } from "nativewind"
import { useEffect, useState } from "react"
import { Platform, View } from "react-native"
import { runCommand } from "../db/commands"
import { suggestions } from "../db/timers"
import { clock } from "../lib/format"
import { useTokenColour } from "../lib/use-token-colour"
import { MicButton } from "./MicButton"
import { SlashMenu, TimerSuggestions } from "./SlashMenu"
import { Text } from "./ui/Text"

// One line of input. Enter submits and keeps focus, so the next line can start at once.
// Mount it with a `key` per entry being edited so `defaultText` is picked up fresh.
//
// The composer styles text; it does not host views (AGENTS.md). live-markdown's
// parser tags character ranges with a closed set of types. The time prefix is
// tagged `mention-here` — the one type that takes both a colour and a field —
// so it reads as the pill it is about to become. The forming rule: it lifts
// only once the time is complete AND a word has started after it, so typing
// `7:20 -> 7:50` is never cut in half at `7:20`.
const Input = styled(MarkdownTextInput, { className: "style" })

// Runs on the UI thread as you type, so it cannot call into @dotbook/core. The
// time regex is the strict prefix from packages/core/src/parse/time.js, inlined,
// followed by whitespace and the first character of the body — which must be
// one that cannot continue the time (not a digit, not a range arrow), so
// `8:30 -` and `8:30 -> 1` stay plain until the range is whole and a word starts.
function parser(text) {
	"worklet"
	const ranges = []
	const time =
		/^\s*\d{1,2}:\d{2}(?:\s?[ap]\.?m\.?)?(?:\s*(?:->|→|-|–|—)\s*\d{1,2}:\d{2}(?:\s?[ap]\.?m\.?)?)?(?=\s+[^\s\d\-–—>→])/i.exec(
			text
		)
	if (time) ranges.push({ type: "mention-here", start: 0, length: time[0].length })
	const command = /^\/\w+/.exec(text)
	if (command) ranges.push({ type: "code", start: 0, length: command[0].length })
	return ranges
}

const NO_SUGGESTIONS = []
const MINUTE_MS = 60 * 1000

export function Composer({ day, defaultText = "", editing = false, onSubmit }) {
	const db = useSQLiteContext()
	const [text, setText] = useState(defaultText)
	// The recording behind the current text, when it came from the microphone.
	// Submitted with the line so it is marked `source: voice` and the audio is kept.
	const [voice, setVoice] = useState(null)
	const now = useMinute()

	// `/` only at column 0; a space closes the menu, so mid-line `/` is just a slash.
	const menuOpen = text.startsWith("/") && !text.includes(" ")
	const timerOpen = text.startsWith("/timer")

	// The durations to offer, read when `/timer` is open and re-read when the
	// database changes (LiveQueries) — the next plan block may have moved.
	const { data: offered = NO_SUGGESTIONS } = useQuery({
		queryKey: ["timer-suggestions", day],
		queryFn: () => suggestions(db, day, Date.now()),
		enabled: timerOpen,
	})

	// The pill inside the input takes the typed hour's tokens; no time typed
	// yet means no pill, and the line will be stamped with `now` on Enter.
	const typed = parseLineTime(text, day, now)
	const hour = String(new Date(typed.tsStart ?? now).getHours()).padStart(2, "0")
	const markdownStyle = {
		mentionHere: {
			color: useTokenColour(`--color-hour-${hour}-on-pill`),
			backgroundColor: useTokenColour(`--color-hour-${hour}-pill`),
		},
		code: { color: useTokenColour("--color-primary"), backgroundColor: useTokenColour("--color-primary-container") },
	}
	// On the web live-markdown's input is its own DOM element: className does not
	// reach it, so the few values it needs come through the same live-token hook.
	const onSurface = useTokenColour("--color-on-surface")
	const placeholderColour = useTokenColour("--color-outline")
	const bodySize = useTokenColour("--text-body")
	const bodyFace = useTokenColour("--font-body")
	const webStyle =
		Platform.OS === "web"
			? { flex: 1, borderWidth: 0, outlineStyle: "none", color: onSurface, fontSize: bodySize, fontFamily: bodyFace }
			: undefined
	const ghost = !editing && text !== "" && !text.startsWith("/") && typed.timeText === ""

	function pickCommand(command) {
		setText(`/${command.name} `)
	}

	function pickMinutes(minutes) {
		setText(`/timer ${minutes}`)
	}

	function keyPress(event) {
		if (menuOpen && event.nativeEvent.key === "Escape") setText("")
	}

	function change(next) {
		setText(next)
		// Clearing the line drops the recording with it: what is submitted must be what was heard.
		if (next === "") setVoice(null)
	}

	// The transcript lands in the line and is NOT submitted: a transcribed line
	// is an ordinary line, and a misheard word gets fixed before Enter.
	function heard(take) {
		setText(take.transcript)
		setVoice(take)
	}

	async function submit() {
		const line = text.trim()
		// `/timer` with nothing after it: close the menu, keep the chips, wait for a number.
		if (line === "/timer") {
			setText("/timer ")
			return
		}
		if (await runCommand(db, day, line)) {
			setText("")
			return
		}
		onSubmit(line, voice)
		setText("")
		setVoice(null)
	}

	return (
		<View
			className={
				editing
					? "border-t border-primary-line bg-primary-wash py-sm"
					: "border-t border-outline-variant bg-surface py-sm"
			}
		>
			{menuOpen ? <SlashMenu query={text.slice(1)} onPick={pickCommand} /> : null}
			{timerOpen ? <TimerSuggestions suggestions={offered} onPick={pickMinutes} /> : null}
			<View className="flex-row items-center gap-xs pl-md pr-sm">
				{/* The time this line will get if none is typed — a ghost, not yet a pill. */}
				{ghost ? (
					<Text variant="mono" className="text-outline">
						{clock(now)}
					</Text>
				) : null}
				<Input
					className="flex-1 font-body text-body text-on-surface"
					style={webStyle}
					value={text}
					onChangeText={change}
					onKeyPress={keyPress}
					onSubmitEditing={submit}
					submitBehavior="submit"
					parser={parser}
					markdownStyle={markdownStyle}
					placeholder="7:36 woke up"
					placeholderTextColor={placeholderColour}
					autoFocus
				/>
				<MicButton onTranscript={setText} onDone={heard} />
			</View>
		</View>
	)
}

// The current minute, so the ghost clock is never stale by more than one.
function useMinute() {
	const [now, setNow] = useState(Date.now)
	useEffect(() => {
		const tick = setInterval(() => setNow(Date.now()), MINUTE_MS)
		return () => clearInterval(tick)
	}, [])
	return now
}
