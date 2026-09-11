import { fuzzyFind } from "@dotbook/core/parse"
import { Pressable, ScrollView, View } from "react-native"
import { Badge } from "./ui/Badge"
import { Text } from "./ui/Text"

// `/` at column 0 opens this list; V0.1 ships one command, but it is a list.
// Our own ~50 lines — every editor that ships a command menu drags in a document model.
const COMMANDS = [{ name: "timer", hint: "minutes, or take the suggestion" }]
const NAMES = COMMANDS.map((command) => command.name)

export function SlashMenu({ query, onPick }) {
	const { ranked } = fuzzyFind(query, NAMES)
	const matches = ranked.map((index) => COMMANDS[index])

	return (
		<View className="mx-md mb-2xs overflow-hidden rounded-seg border border-outline-variant bg-surface">
			{matches.map((command) => (
				<Command key={command.name} command={command} onPick={onPick} />
			))}
			{matches.length === 0 ? (
				<Text variant="label" className="px-sm py-xs text-on-surface-variant">
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
			className="flex-row items-baseline gap-sm px-sm py-xs active:bg-surface-container-highest"
		>
			<Text variant="mono" className="text-primary">
				/{command.name}
			</Text>
			<Text variant="label" className="text-on-surface-variant">
				{command.hint}
			</Text>
		</Pressable>
	)
}

// Durations offered for `/timer`, as chips. Tapping one writes the number into
// the line — always visible before it commits, never applied silently.
export function TimerSuggestions({ suggestions, onPick }) {
	if (suggestions.length === 0) return null
	return (
		<ScrollView horizontal keyboardShouldPersistTaps="handled" contentContainerClassName="gap-xs px-md pb-2xs">
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
