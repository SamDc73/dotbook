import { applyDeviation, diffItems } from "@dotbook/core/templates"
import { useSQLiteContext } from "expo-sqlite"
import { useState } from "react"
import { Pressable, Text, View } from "react-native"
import { saveDeviation } from "../db/templates"
import { Button } from "./ui/Button"
import { Input } from "./ui/Input"
import { Text as Label } from "./ui/Text"

// What a templated line actually contained: its snapshot with this entry's
// deviation applied. Editing here changes this entry only — never the version.
export function TemplateExpansion({ entry }) {
	const db = useSQLiteContext()
	const items = applyDeviation(entry.snapshot, entry.deviation)
	const [draft, setDraft] = useState(null) // the items as text while editing, else null

	function startEditing() {
		setDraft(items.join("\n"))
	}

	function cancel() {
		setDraft(null)
	}

	async function save() {
		const edited = draft
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line !== "")
		await saveDeviation(db, entry.id, diffItems(entry.snapshot, edited))
		setDraft(null)
	}

	if (draft !== null) {
		return (
			<View className="mx-md mb-xs gap-xs rounded-md bg-surface-container-low p-sm">
				<Input value={draft} onChangeText={setDraft} multiline autoFocus />
				<View className="flex-row justify-end gap-sm">
					<Button variant="text" size="sm" onPress={cancel}>
						<Label>Cancel</Label>
					</Button>
					<Button size="sm" onPress={save}>
						<Label>Save</Label>
					</Button>
				</View>
			</View>
		)
	}

	return (
		<Pressable onPress={startEditing} className="mx-md mb-xs rounded-md bg-surface-container-low p-sm">
			{items.map((item) => (
				<Text key={item} className="text-body text-on-surface-variant">
					{item}
				</Text>
			))}
			{entry.deviation !== null ? <Text className="mt-2xs text-caption text-warning">edited on this day</Text> : null}
		</Pressable>
	)
}
