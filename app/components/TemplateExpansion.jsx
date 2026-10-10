import { applyDeviation, diffItems } from "@dotbook/core/templates"
import { useSQLiteContext } from "expo-sqlite"
import { useState } from "react"
import { Pressable, View } from "react-native"
import { saveDeviation } from "../db/templates"
import { Button } from "./ui/Button"
import { Input } from "./ui/Input"
import { Text } from "./ui/Text"

// What a templated line actually contained: its snapshot with this entry's
// deviation applied, drawn as the template's `.stackout` — a primary rule down
// the left, the primary wash behind, mono items. Editing here changes this
// entry only — never the version.
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
			<View className={`${STACKOUT} gap-xs`}>
				<Input value={draft} onChangeText={setDraft} multiline autoFocus className="font-mono-regular" />
				<View className="flex-row justify-end gap-sm">
					<Button variant="text" size="sm" onPress={cancel}>
						<Text>Cancel</Text>
					</Button>
					<Button size="sm" onPress={save}>
						<Text>Save</Text>
					</Button>
				</View>
			</View>
		)
	}

	return (
		<Pressable onPress={startEditing} className={STACKOUT}>
			{items.map((item) => (
				<Text key={item} variant="data" className="text-on-surface">
					{item}
				</Text>
			))}
			{entry.deviation !== null ? (
				<Text variant="data" className="mt-2xs text-warning">
					edited on this day
				</Text>
			) : null}
		</Pressable>
	)
}

const STACKOUT = "my-2xs rounded-r-md border-l-2 border-primary bg-primary-wash px-md py-sm"
