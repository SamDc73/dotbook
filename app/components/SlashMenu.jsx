import { Pressable, View } from "react-native"
import { Text } from "./ui/Text"

// `/` at column 0 opens this list — the commands `app/db/commands.js` runs.
// It is drawn directly under the composer's row, aligned to its text: no
// panel, no border, one line per command — the name in mono, the hint muted —
// and the highlighted one on the primary wash. ↑ ↓ move the highlight, Enter
// or Tab picks, Esc closes, a space closes (the keys are the composer's; on
// native the list is tap-only). Our own ~60 lines — every editor that ships a
// command menu drags in a document model.
export function SlashMenu({ matches, highlight, onPick }) {
	if (matches.length === 0) {
		return (
			<Text variant="label" className="py-xs text-on-surface-variant">
				no command
			</Text>
		)
	}
	return (
		<View className="pb-xs">
			{matches.map((command, index) => (
				<Row
					key={command.name}
					selected={index === highlight}
					lead={`/${command.name}`}
					hint={command.hint}
					onPick={() => onPick(command)}
				/>
			))}
		</View>
	)
}

// Durations offered once `/timer ` is typed, the same list under the same
// row. Picking one writes the number into the line — always visible before it
// commits, never applied silently; typing a number ignores the list.
export function TimerSuggestions({ suggestions, highlight, onPick }) {
	if (suggestions.length === 0) return null
	return (
		<View className="pb-xs">
			{suggestions.map((suggestion, index) => {
				const [lead, hint] = suggestion.label.split(" — ")
				return (
					<Row
						key={suggestion.label}
						selected={index === highlight}
						lead={lead}
						hint={hint}
						onPick={() => onPick(suggestion.minutes)}
					/>
				)
			})}
		</View>
	)
}

function Row({ selected, lead, hint, onPick }) {
	return (
		<Pressable
			onPress={onPick}
			role="menuitem"
			aria-selected={selected}
			className={
				selected
					? "flex-row items-baseline gap-sm rounded-item bg-primary-wash px-xs py-2xs"
					: "flex-row items-baseline gap-sm rounded-item px-xs py-2xs"
			}
		>
			<Text variant="mono" className="text-primary">
				{lead}
			</Text>
			{hint ? (
				<Text variant="line" className="flex-1 text-on-surface-variant">
					{hint}
				</Text>
			) : null}
		</Pressable>
	)
}
