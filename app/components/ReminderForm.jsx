import { useState } from "react"
import { Pressable, Text, TextInput, View } from "react-native"

// A template's daily reminder: the time, an optional second nudge (T2, minutes
// after), and whether it should be a plain notification or an alarm.
export function ReminderForm({ onSubmit, onCancel }) {
	const [at, setAt] = useState("09:00")
	const [escalation, setEscalation] = useState("")
	const [style, setStyle] = useState("notify")

	const complete = /^([01]?\d|2[0-3]):[0-5]\d$/.test(at.trim()) && /^\d*$/.test(escalation.trim())

	function submit() {
		const minutes = escalation.trim()
		onSubmit({ at: at.trim().padStart(5, "0"), escalationMin: minutes === "" ? null : Number(minutes), style })
	}

	return (
		<View className="gap-sm rounded-md bg-surface-container-low p-md">
			<Field label="Time" value={at} onChangeText={setAt} placeholder="09:00" autoFocus />
			<Field
				label="Second nudge after (minutes, optional)"
				value={escalation}
				onChangeText={setEscalation}
				placeholder="30"
				keyboardType="number-pad"
			/>
			<View className="flex-row gap-xs">
				<Choice label="Notify" selected={style === "notify"} onPress={() => setStyle("notify")} />
				<Choice label="Alarm" selected={style === "alarm"} onPress={() => setStyle("alarm")} />
			</View>
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

function Choice({ label, selected, onPress }) {
	return (
		<Pressable
			onPress={onPress}
			className={selected ? "rounded-md bg-secondary-container px-sm py-xs" : "rounded-md bg-surface px-sm py-xs"}
		>
			<Text className={selected ? "text-label text-on-secondary-container" : "text-label text-on-surface-variant"}>
				{label}
			</Text>
		</Pressable>
	)
}
