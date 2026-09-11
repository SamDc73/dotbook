import { fuzzyFind } from "@dotbook/core/parse"
import { Pressable, ScrollView, View } from "react-native"
import { COMMANDS } from "../db/commands"
import { Badge } from "./ui/Badge"
import { Text } from "./ui/Text"

// `/` at column 0 opens this list — the commands `app/db/commands.js` runs.
// It is drawn as rows of the log directly above the composer's row, not as a
// panel: the same seam, the command in mono where the pill would be, its hint
// as the line. Our own ~50 lines — every editor that ships a command menu
// drags in a document model.
const NAMES = COMMANDS.map((command) => command.name)

export function SlashMenu({ query, onPick }) {
	const { ranked } = fuzzyFind(query, NAMES)
	const matches = ranked.map((index) => COMMANDS[index])

	return (
		<View>
			{matches.map((command) => (
				<Command key={command.name} command={command} onPick={onPick} />
			))}
			{matches.length === 0 ? (
				<Text variant="label" className="py-xs text-on-surface-variant">
					no command
				</Text>
			) : null}
		</View>
	)
}

function Command({ command, onPick }) {
	function pick() {
		onPick(command)
	}
	return (
		<Pressable
			onPress={pick}
			className="flex-row items-baseline gap-sm border-b border-dashed border-outline-variant py-xs active:bg-primary-wash"
		>
			<Text variant="mono" className="text-primary">
				/{command.name}
			</Text>
			<Text variant="line" className="text-on-surface-variant">
				{command.hint}
			</Text>
		</Pressable>
	)
}

// Durations offered for `/timer`, as chips on a row of their own. Tapping one
// writes the number into the line — always visible before it commits, never
// applied silently.
export function TimerSuggestions({ suggestions, onPick }) {
	if (suggestions.length === 0) return null
	return (
		<ScrollView
			horizontal
			keyboardShouldPersistTaps="handled"
			className="border-b border-dashed border-outline-variant"
			contentContainerClassName="gap-xs py-xs"
		>
			{suggestions.map((suggestion) => (
				<Badge
					key={suggestion.label}
					variant="primary"
					className="rounded-lg px-sm py-2xs"
					onPress={() => onPick(suggestion.minutes)}
				>
					{suggestion.label}
				</Badge>
			))}
		</ScrollView>
	)
}
