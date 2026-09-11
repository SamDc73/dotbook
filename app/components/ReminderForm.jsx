import { parseLineTime } from "@dotbook/core/parse"
import { useState } from "react"
import { View } from "react-native"
import { today } from "../lib/day"
import { Badge } from "./ui/Badge"
import { Button } from "./ui/Button"
import { Input } from "./ui/Input"
import { Text } from "./ui/Text"

const STYLES = ["notify", "alarm"]

// A template's daily reminder: the time, an optional second nudge (T2, minutes
// after), and whether it should be a plain notification or an alarm.
export function ReminderForm({ onSubmit, onCancel }) {
	const [at, setAt] = useState("9:00 am")
	const [escalation, setEscalation] = useState("")
	const [style, setStyle] = useState("notify")

	// The time is read by the line parser, so `9:00 am`, `9:00` and `21:00` all
	// work; it is stored as `HH:MM` (24-hour) because that is what the daily
	// trigger takes. A range is not a reminder time.
	const parsed = parseLineTime(`${at.trim()} x`, today())
	const complete = parsed.tsStart !== null && parsed.tsEnd === null && /^\d*$/.test(escalation.trim())

	function submit() {
		const minutes = escalation.trim()
		const when = new Date(parsed.tsStart)
		const hhmm = `${String(when.getHours()).padStart(2, "0")}:${String(when.getMinutes()).padStart(2, "0")}`
		onSubmit({ at: hhmm, escalationMin: minutes === "" ? null : Number(minutes), style })
	}

	return (
		<View className="gap-sm rounded-panel border border-outline-variant bg-surface p-md">
			<Field label="Time" value={at} onChangeText={setAt} placeholder="9:00 am" autoFocus />
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
					<Text>Cancel</Text>
				</Button>
				<Button onPress={submit} disabled={!complete}>
					<Text>Save</Text>
				</Button>
			</View>
		</View>
	)
}

function Field({ label, ...input }) {
	return (
		<View className="gap-2xs">
			<Text variant="eyebrow">{label}</Text>
			<Input {...input} />
		</View>
	)
}
