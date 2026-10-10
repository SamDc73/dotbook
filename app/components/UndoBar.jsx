import { View } from "react-native"
import { tap } from "../lib/haptics"
import { takeUndo, useUndoOffer } from "../lib/undo"
import { Button } from "./ui/Button"
import { Text } from "./ui/Text"

// The undo snackbar, Material 3's: the inverse surface over the screen's foot,
// one line of callout text and an Undo in inverse primary. Padded like a row of
// callout text, turned like a body-text box. Screen readers hear it arrive.
export function UndoBar() {
	const offer = useUndoOffer()
	if (offer === null) return null

	function press() {
		tap("undone")
		takeUndo()
	}

	return (
		<View
			role="alert"
			accessibilityLiveRegion="polite"
			className="absolute right-md bottom-md left-md flex-row items-center gap-sm rounded-md bg-inverse-surface py-2xs pr-2xs pl-md shadow-panel"
		>
			<Text variant="line" numberOfLines={1} className="flex-1 text-inverse-on-surface">
				{offer.label}
			</Text>
			<Button variant="text" size="sm" onPress={press}>
				<Text className="text-inverse-primary">Undo</Text>
			</Button>
		</View>
	)
}
