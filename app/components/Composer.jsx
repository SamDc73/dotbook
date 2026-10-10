import { parseLineTime } from "@dotbook/core/parse"
import { useQuery } from "@tanstack/react-query"
import { useSQLiteContext } from "expo-sqlite"
import { useEffect, useState } from "react"
import { View } from "react-native"
import { runCommand } from "../db/commands"
import { suggestions } from "../db/timers"
import { clock } from "../lib/format"
import { gutter } from "../lib/gutter"
import { tap } from "../lib/haptics"
import { matchCommands } from "../lib/menu"
import { useDraft } from "../lib/use-draft"
import { LineInput } from "./LineInput"
import { Seam } from "./LogList"
import { MicButton } from "./MicButton"
import { SlashMenu, TimerSuggestions } from "./SlashMenu"
import { Text } from "./ui/Text"

// The next line of the log — not a box beneath it. This is the log's last row:
// the same gutter and grid as a line, a dashed seam above it when there are
// lines, none below. Where the pill will be sits a ghost pill — a dashed
// hairline around the current minute, muted — until a time is typed with a
// body, at which point the pill forms inside the input itself and the ghost
// steps aside. Enter commits the line above and the row is empty again, focus
// kept. The `/` menu and the timer's suggestions open UNDER this row, never
// over the log. Editing an existing line happens in that line's own row
// (EntryLine), not here.
const NO_SUGGESTIONS = []
// The half-typed line survives the app being closed (lib/use-draft.js).
const DRAFT_KEY = "composer-draft"
const MINUTE_MS = 60 * 1000

// `onListOpen` is called when the slash menu or the timer's durations open under
// the input — the composer is the log's last row, so on a long day the list
// would open below the screen; the log scrolls it into view. `inputRef` reaches
// the input, for the screen to focus it.
export function Composer({ day, seam = false, onSubmit, onListOpen, inputRef }) {
	const db = useSQLiteContext()
	const [text, setText] = useDraft(DRAFT_KEY)
	// The recording behind the current text, when it came from the microphone.
	// Submitted with the line so it is marked `source: voice` and the audio is kept.
	const [voice, setVoice] = useState(null)
	// Which row of the open list ↑ ↓ have reached; reset whenever the text changes.
	const [highlight, setHighlight] = useState(0)
	const now = useMinute()

	// `/` only at column 0; a space closes the menu, so mid-line `/` is just a slash.
	const menuOpen = text.startsWith("/") && !text.includes(" ")
	const matches = menuOpen ? matchCommands(text.slice(1)) : NO_SUGGESTIONS
	// `/timer ` with no number yet: the durations are the list. A typed number ignores them.
	const timerListOpen = /^\/timer\s*$/.test(text)

	// The durations to offer, read when `/timer` is open and re-read when the
	// database changes (LiveQueries) — the next plan block may have moved.
	const { data: offered = NO_SUGGESTIONS } = useQuery({
		queryKey: ["timer-suggestions", day],
		queryFn: () => suggestions(db, day, Date.now()),
		enabled: text.startsWith("/timer"),
	})

	const list = listFor(menuOpen, matches, timerListOpen, offered)
	const index = list === null ? 0 : Math.min(highlight, list.length - 1)
	const ghost = !text.startsWith("/") && parseLineTime(text, day, now).timeText === ""

	function pickCommand(command) {
		setText(`/${command.name} `)
		setHighlight(0)
	}

	function pickMinutes(minutes) {
		setText(`/timer ${minutes}`)
	}

	function pick(item) {
		if (menuOpen) pickCommand(item)
		else pickMinutes(item.minutes)
	}

	// Keys only the web delivers (`ArrowUp`, `ArrowDown`, `Tab`, `Escape`); on
	// native the list is tap-only. Arrows and Tab must not move the caret or focus.
	function keyPress(event) {
		const key = event.nativeEvent.key
		if (key === "Escape" && (menuOpen || timerListOpen)) {
			setText("")
			return
		}
		if (list === null) return
		if (key === "ArrowDown" || key === "ArrowUp") {
			event.preventDefault?.()
			const step = key === "ArrowDown" ? 1 : list.length - 1
			setHighlight((current) => (Math.min(current, list.length - 1) + step) % list.length)
		}
		if (key === "Tab") {
			event.preventDefault?.()
			pick(list[index])
		}
	}

	function change(next) {
		if (next.startsWith("/") && !text.startsWith("/")) onListOpen?.()
		setText(next)
		setHighlight(0)
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
		// Enter on an open list picks its highlighted row instead of committing.
		if (list !== null && list.length > 0) {
			pick(list[index])
			return
		}
		const line = text.trim()
		// `/timer` with nothing after it and nothing to offer: wait for a number.
		if (line === "/timer") {
			setText("/timer ")
			return
		}
		if (await runCommand(db, day, line)) {
			tap("logged")
			setText("")
			return
		}
		onSubmit(line, voice)
		tap("logged")
		setText("")
		setVoice(null)
	}

	return (
		<View className={gutter(null)}>
			{seam ? <Seam /> : null}
			<View className="flex-row items-center gap-sm py-xs">
				{/* The time this line will get if none is typed — a ghost, not yet a pill. */}
				{ghost ? (
					<View className="rounded-chip border border-dashed border-outline-variant px-xs py-3xs">
						<Text variant="mono" className="text-on-surface-variant">
							{clock(now)}
						</Text>
					</View>
				) : null}
				<LineInput
					ref={inputRef}
					value={text}
					day={day}
					now={now}
					onChangeText={change}
					onKeyPress={keyPress}
					onSubmitEditing={submit}
					placeholder="7:36 woke up"
					autoFocus
				/>
				<MicButton onTranscript={setText} onDone={heard} />
			</View>
			{menuOpen ? <SlashMenu matches={matches} highlight={index} onPick={pickCommand} /> : null}
			{timerListOpen ? <TimerSuggestions suggestions={offered} highlight={index} onPick={pickMinutes} /> : null}
		</View>
	)
}

// The rows the arrow keys walk: the command matches, or the timer's durations.
function listFor(menuOpen, matches, timerListOpen, offered) {
	if (menuOpen) return matches
	if (timerListOpen && offered.length > 0) return offered
	return null
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
