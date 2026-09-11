import { useState } from "react"
import { TextInput, View } from "react-native"

// One line of input. Enter submits and keeps focus, so the next line can start at once.
// Mount it with a `key` per entry being edited so `defaultText` is picked up fresh.
export function Composer({ defaultText = "", editing = false, onSubmit }) {
	const [text, setText] = useState(defaultText)

	function submit() {
		onSubmit(text.trim())
		setText("")
	}

	return (
		<View className={editing ? "px-md py-sm bg-primary-container" : "px-md py-sm bg-surface-container"}>
			<TextInput
				className="text-body text-on-surface"
				value={text}
				onChangeText={setText}
				onSubmitEditing={submit}
				submitBehavior="submit"
				placeholder="7:36 woke up"
				autoFocus
			/>
		</View>
	)
}
