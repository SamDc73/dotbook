import { useSQLiteContext } from "expo-sqlite"
import { Pressable, Text, View } from "react-native"
import { answerProposal } from "../db/todos"

// Log ranges that look like this todo, waiting for a yes or a no. A proposal is
// never applied silently (V0.1 → feature 17): "Link" counts the line's time from
// now on, "Not this" remembers the refusal so the line is not proposed again.
export function TodoProposals({ todo, proposals }) {
	const db = useSQLiteContext()

	return (
		<View className="gap-2xs pb-xs">
			{proposals.map((entry) => (
				<Proposal key={entry.id} todoId={todo.id} entry={entry} db={db} />
			))}
		</View>
	)
}

function Proposal({ todoId, entry, db }) {
	function link() {
		answerProposal(db, todoId, entry.id, true)
	}
	function notThis() {
		answerProposal(db, todoId, entry.id, false)
	}

	return (
		<View className="flex-row items-center gap-xs px-xl">
			<Text className="flex-1 text-label text-on-surface-variant" numberOfLines={2}>
				{entry.text}
			</Text>
			<Pressable onPress={link} className="rounded-sm bg-primary-container px-2xs py-3xs active:opacity-80">
				<Text className="text-label text-on-primary-container">Link</Text>
			</Pressable>
			<Pressable onPress={notThis} className="rounded-sm px-2xs py-3xs active:bg-surface-container">
				<Text className="text-label text-on-surface-variant">Not this</Text>
			</Pressable>
		</View>
	)
}
