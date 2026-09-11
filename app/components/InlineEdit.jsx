import { useSQLiteContext } from "expo-sqlite"
import { useRef, useState } from "react"
import { View } from "react-native"
import { updateEntryText } from "../db/entries"
import { LineInput } from "./LineInput"

// The row while it is being edited: the raw text in the line input, cursor at
// the end. Commit and cancel each happen once — Enter commits and the row
// unmounts, and the blur that follows must not commit again.
export function InlineEdit({ entry, onDone }) {
	const db = useSQLiteContext()
	const [text, setText] = useState(entry.text)
	const settled = useRef(false)

	function commit() {
		if (settled.current) return
		settled.current = true
		const line = text.trim()
		if (line !== "" && line !== entry.text) updateEntryText(db, entry.id, line, entry.day)
		onDone()
	}
	function cancel() {
		if (settled.current) return
		settled.current = true
		onDone()
	}
	function keyPress(event) {
		if (event.nativeEvent.key === "Escape") cancel()
	}

	return (
		<View className="flex-row items-center gap-sm bg-primary-wash py-xs">
			<LineInput
				value={text}
				day={entry.day}
				selectEnd
				autoFocus
				onChangeText={setText}
				onKeyPress={keyPress}
				onSubmitEditing={commit}
				onBlur={commit}
				accessibilityLabel={`Editing: ${entry.text}`}
			/>
		</View>
	)
}
