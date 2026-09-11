import { MarkdownTextInput } from "@expensify/react-native-live-markdown"
import { useSQLiteContext } from "expo-sqlite"
import { styled } from "nativewind"
import { useEffect, useState } from "react"
import { View } from "react-native"
import { suggestions } from "../db/timers"
import { useTokenColour } from "../lib/use-token-colour"
import { SlashMenu, TimerSuggestions } from "./SlashMenu"

// One line of input. Enter submits and keeps focus, so the next line can start at once.
// Mount it with a `key` per entry being edited so `defaultText` is picked up fresh.
//
// The composer styles text; it does not host views (AGENTS.md). live-markdown's
// parser tags character ranges with a closed set of types; two are used here.
const Input = styled(MarkdownTextInput, { className: "style" })

// Runs on the UI thread as you type, so it cannot call into @dotbook/core. The
// time regex is the strict prefix from packages/core/src/parse/time.js, inlined.
function parser(text) {
	"worklet"
	const ranges = []
	const time =
		/^\s*\d{1,2}:\d{2}(?:\s?[ap]\.?m\.?)?(?:\s*(?:->|→|-|–|—)\s*\d{1,2}:\d{2}(?:\s?[ap]\.?m\.?)?)?(?=\s|$)/i.exec(text)
	if (time) ranges.push({ type: "syntax", start: 0, length: time[0].length })
	const command = /^\/\w+/.exec(text)
	if (command) ranges.push({ type: "code", start: 0, length: command[0].length })
	return ranges
}

const TIMER = /^\/timer\s+(\d+)\s*$/

export function Composer({ day, defaultText = "", editing = false, onSubmit, onTimer }) {
	const db = useSQLiteContext()
	const [text, setText] = useState(defaultText)
	const [offered, setOffered] = useState([])

	// `/` only at column 0; a space closes the menu, so mid-line `/` is just a slash.
	const menuOpen = text.startsWith("/") && !text.includes(" ")
	const timerOpen = text.startsWith("/timer")

	const markdownStyle = {
		syntax: { color: useTokenColour("--color-on-surface-variant") },
		code: { color: useTokenColour("--color-primary"), backgroundColor: useTokenColour("--color-primary-container") },
	}

	useEffect(() => {
		if (!timerOpen) return
		suggestions(db, day, Date.now()).then(setOffered)
	}, [db, day, timerOpen])

	function pickCommand(command) {
		setText(`/${command.name} `)
	}

	function pickMinutes(minutes) {
		setText(`/timer ${minutes}`)
	}

	function keyPress(event) {
		if (menuOpen && event.nativeEvent.key === "Escape") setText("")
	}

	function submit() {
		const line = text.trim()
		const timer = TIMER.exec(line)
		if (timer) {
			onTimer(Number(timer[1]), line)
			setText("")
			return
		}
		// `/timer` with nothing after it: close the menu, keep the chips, wait for a number.
		if (line === "/timer") {
			setText("/timer ")
			return
		}
		onSubmit(line)
		setText("")
	}

	return (
		<View className={editing ? "py-sm bg-primary-container" : "py-sm bg-surface-container"}>
			{menuOpen ? <SlashMenu query={text.slice(1)} onPick={pickCommand} /> : null}
			{timerOpen ? <TimerSuggestions suggestions={offered} onPick={pickMinutes} /> : null}
			<Input
				className="px-md text-body text-on-surface"
				value={text}
				onChangeText={setText}
				onKeyPress={keyPress}
				onSubmitEditing={submit}
				submitBehavior="submit"
				parser={parser}
				markdownStyle={markdownStyle}
				placeholder="7:36 woke up"
				autoFocus
			/>
		</View>
	)
}
