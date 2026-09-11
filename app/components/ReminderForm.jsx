import { useState } from "react"
import { Text, View } from "react-native"
import { Badge } from "./ui/Badge"
import { Button } from "./ui/Button"
import { Input } from "./ui/Input"
import { Text as Label } from "./ui/Text"

const STYLES = ["notify", "alarm"]

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
				{STYLES.map((option) => (
					<Badge key={option} variant={style === option ? "secondary" : "plain"} onPress={() => setStyle(option)}>
						{option}
					</Badge>
				))}
			</View>
			<View className="flex-row justify-end gap-sm">
				<Button variant="text" onPress={onCancel}>
					<Label>Cancel</Label>
				</Button>
				<Button onPress={submit} disabled={!complete}>
					<Label>Save</Label>
				</Button>
			</View>
		</View>
	)
}

function Field({ label, ...input }) {
	return (
		<View className="gap-2xs">
			<Text className="text-caption text-on-surface-variant">{label}</Text>
			<Input {...input} />
		</View>
	)
}
