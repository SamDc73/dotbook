import { parseLineTime } from "@dotbook/core/parse"
import { useSQLiteContext } from "expo-sqlite"
import { useState } from "react"
import { View } from "react-native"
import { scheduleTodo, setDueOn } from "../db/todos"
import { shiftDay } from "../lib/day"
import { Badge } from "./ui/Badge"
import { Button } from "./ui/Button"
import { Input } from "./ui/Input"
import { Text } from "./ui/Text"

// Opens under a todo. Two decisions, both a person's: which day it is due
// (empty = the queue), and — only if wanted — a planned window, which becomes
// an ordinary `plan` line linked back to the todo.
export function TodoEditor({ todo, today, onDone }) {
	const db = useSQLiteContext()
	const [dueOn, setDue] = useState(todo.due_on ?? "")
	const [window, setWindow] = useState("")
	const [day, setDay] = useState(todo.due_on ?? today)

	// A range is required: a scheduled todo says when it starts and ends.
	const parsedWindow = parseLineTime(`${window.trim()} x`, day)
	const canSchedule = parsedWindow.tsEnd !== null && /^\d{4}-\d{2}-\d{2}$/.test(day)

	async function saveDue(value) {
		await setDueOn(db, todo.id, value === "" ? null : value)
		onDone()
	}
	function submitDue() {
		saveDue(dueOn.trim())
	}
	function queue() {
		saveDue("")
	}
	function dueToday() {
		saveDue(today)
	}
	function dueTomorrow() {
		saveDue(shiftDay(today, 1))
	}

	async function schedule() {
		await scheduleTodo(db, todo, { day, text: `${parsedWindow.timeText} ${todo.text}` })
		onDone()
	}

	return (
		<View className="mx-md mb-sm gap-sm rounded-panel border border-outline-variant bg-surface p-sm">
			<View className="flex-row items-center gap-xs">
				<Text variant="eyebrow">Due</Text>
				<Badge variant="surface" onPress={queue}>
					Queue
				</Badge>
				<Badge variant="surface" onPress={dueToday}>
					Today
				</Badge>
				<Badge variant="surface" onPress={dueTomorrow}>
					Tomorrow
				</Badge>
				<Input
					className="flex-1 py-2xs text-label"
					value={dueOn}
					onChangeText={setDue}
					onSubmitEditing={submitDue}
					placeholder="YYYY-MM-DD"
				/>
			</View>
			<View className="flex-row items-center gap-xs">
				<Text variant="eyebrow">Plan</Text>
				<Input
					className="flex-1 py-2xs text-label"
					value={window}
					onChangeText={setWindow}
					placeholder="15:30 -> 16:00"
				/>
				<Input className="py-2xs text-label" value={day} onChangeText={setDay} placeholder="YYYY-MM-DD" />
				<Button size="sm" onPress={schedule} disabled={!canSchedule}>
					<Text>Schedule</Text>
				</Button>
			</View>
			<Button variant="text" size="sm" className="self-end" onPress={onDone}>
				<Text>Close</Text>
			</Button>
		</View>
	)
}
