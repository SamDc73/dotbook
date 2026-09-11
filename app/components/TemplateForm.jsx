import { useState } from "react"
import { Pressable, Text, TextInput, View } from "react-native"
import { today } from "../lib/day"

// One form for both "new template" and "new version": a name is asked only when
// there is no template yet. Contents are one item per line, exactly as they will
// be snapshotted onto entries.
export function TemplateForm({ withName = false, defaultLabel, onSubmit, onCancel }) {
	const [name, setName] = useState("")
	const [label, setLabel] = useState(defaultLabel)
	const [effectiveFrom, setEffectiveFrom] = useState(today)
	const [contents, setContents] = useState("")

	const complete = (!withName || name.trim() !== "") && label.trim() !== "" && contents.trim() !== ""

	function submit() {
		const items = contents
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line !== "")
		onSubmit({ name: name.trim(), label: label.trim(), effectiveFrom: effectiveFrom.trim(), contents: items })
	}

	return (
		<View className="gap-sm rounded-md bg-surface-container-low p-md">
			{withName ? <Field label="Name" value={name} onChangeText={setName} placeholder="nootstack" autoFocus /> : null}
			<Field label="Version" value={label} onChangeText={setLabel} placeholder="1.0" />
			<Field label="Effective from" value={effectiveFrom} onChangeText={setEffectiveFrom} placeholder="YYYY-MM-DD" />
			<Field
				label="Contents, one per line"
				value={contents}
				onChangeText={setContents}
				placeholder={"caffeine 100mg\nl-theanine 200mg"}
				multiline
			/>
			<View className="flex-row justify-end gap-sm">
				<Pressable onPress={onCancel} className="rounded-md px-sm py-xs active:bg-surface-container">
					<Text className="text-label text-on-surface-variant">Cancel</Text>
				</Pressable>
				<Pressable
					onPress={submit}
					disabled={!complete}
					className={complete ? "rounded-md bg-primary px-sm py-xs" : "rounded-md bg-surface-variant px-sm py-xs"}
				>
					<Text className={complete ? "text-label text-on-primary" : "text-label text-on-surface-variant"}>Save</Text>
				</Pressable>
			</View>
		</View>
	)
}

function Field({ label, ...input }) {
	return (
		<View className="gap-2xs">
			<Text className="text-caption text-on-surface-variant">{label}</Text>
			<TextInput className="rounded-sm bg-surface px-sm py-xs text-body text-on-surface" {...input} />
		</View>
	)
}
