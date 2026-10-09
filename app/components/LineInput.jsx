import { parseLineTime } from "@dotbook/core/parse"
import { MarkdownTextInput } from "@expensify/react-native-live-markdown"
import { styled } from "nativewind"
import { useState } from "react"
import { Platform } from "react-native"
import { useTokenColour } from "../lib/use-token-colour"

// The one input a line is typed into — the composer's next-line row and a row
// being edited in place share it. It styles text; it hosts no views
// (AGENTS.md). live-markdown's parser tags character ranges with a closed set
// of types: the time prefix is tagged `mention-here`, the one type that takes
// both a colour and a field, so it reads as the pill it is about to become.
// The forming rule: it lifts only once the time is complete AND a word has
// started after it, so typing `7:20 -> 7:50` is never cut in half at `7:20`.
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

/**
 * @param {string} value      the line as typed so far
 * @param {string} day        the day it belongs to, for the hour the pill takes
 * @param {boolean} selectEnd put the cursor after the last character on mount (editing a line)
 */
export function LineInput({ value, day, now = Date.now(), selectEnd = false, className, ...props }) {
	// The pill inside the input takes the typed hour's tokens.
	const typed = parseLineTime(value, day, now)
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
	const lineSize = useTokenColour("--text-line")
	const bodyFace = useTokenColour("--font-body")
	const webStyle =
		Platform.OS === "web"
			? { flex: 1, borderWidth: 0, outlineStyle: "none", color: onSurface, fontSize: lineSize, fontFamily: bodyFace }
			: undefined

	// Cursor at the end when a line is opened for editing: one controlled
	// selection on mount, then the input keeps its own.
	const [selection, setSelection] = useState(() => (selectEnd ? { start: value.length, end: value.length } : undefined))
	function selectionChange() {
		if (selection) setSelection(undefined)
	}

	return (
		<Input
			className={className ?? "flex-1 font-body text-line text-on-surface"}
			style={webStyle}
			value={value}
			parser={parser}
			markdownStyle={markdownStyle}
			placeholderTextColor={placeholderColour}
			submitBehavior="submit"
			selection={selection}
			onSelectionChange={selectionChange}
			{...props}
		/>
	)
}
