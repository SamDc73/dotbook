import { fuzzyFind } from "@dotbook/core/parse"
import { Pressable, ScrollView, Text, View } from "react-native"

// `/` at column 0 opens this list; V0.1 ships one command, but it is a list.
// Our own ~60 lines — every editor that ships a command menu drags in a document model.
const COMMANDS = [{ name: "timer", hint: "minutes, or take the suggestion" }]

export function SlashMenu({ query, onPick }) {
	const { ranked } = fuzzyFind(
		query,
		COMMANDS.map((command) => command.name)
	)
	const matches = ranked.map((index) => COMMANDS[index])

	return (
		<View className="mx-md mb-2xs rounded-md bg-surface-container-high">
			{matches.map((command) => (
				<Command key={command.name} command={command} onPick={onPick} />
			))}
			{matches.length === 0 ? <Text className="px-sm py-xs text-label text-on-surface-variant">no command</Text> : null}
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
			<Text className="font-mono text-body text-primary">/{command.name}</Text>
			<Text className="text-label text-on-surface-variant">{command.hint}</Text>
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
				<Chip key={suggestion.label} suggestion={suggestion} onPick={onPick} />
			))}
		</ScrollView>
	)
}

function Chip({ suggestion, onPick }) {
	function pick() {
		onPick(suggestion.minutes)
	}
	return (
		<Pressable onPress={pick} className="rounded-lg bg-primary-container px-sm py-2xs active:opacity-80">
			<Text className="text-label text-on-primary-container">{suggestion.label}</Text>
		</Pressable>
	)
}
