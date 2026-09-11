import { parseLineTime } from "@dotbook/core/parse"
import { useSQLiteContext } from "expo-sqlite"
import { useState } from "react"
import { Pressable, Text, TextInput, View } from "react-native"
import { scheduleTodo, setDueOn } from "../db/todos"
import { shiftDay } from "../lib/day"

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
		<View className="mx-md mb-sm gap-sm rounded-md bg-surface-container-low p-sm">
			<View className="flex-row items-center gap-xs">
				<Text className="text-caption text-on-surface-variant">Due</Text>
				<Choice onPress={queue}>Queue</Choice>
				<Choice onPress={dueToday}>Today</Choice>
				<Choice onPress={dueTomorrow}>Tomorrow</Choice>
				<TextInput
					className="flex-1 rounded-sm bg-surface px-sm py-2xs text-label text-on-surface"
					value={dueOn}
					onChangeText={setDue}
					onSubmitEditing={submitDue}
					placeholder="YYYY-MM-DD"
				/>
			</View>
			<View className="flex-row items-center gap-xs">
				<Text className="text-caption text-on-surface-variant">Plan</Text>
				<TextInput
					className="flex-1 rounded-sm bg-surface px-sm py-2xs text-label text-on-surface"
					value={window}
					onChangeText={setWindow}
					placeholder="15:30 -> 16:00"
				/>
				<TextInput
					className="rounded-sm bg-surface px-sm py-2xs text-label text-on-surface"
					value={day}
					onChangeText={setDay}
					placeholder="YYYY-MM-DD"
				/>
				<Pressable
					onPress={schedule}
					disabled={!canSchedule}
					className={canSchedule ? "rounded-md bg-primary px-sm py-2xs" : "rounded-md bg-surface-variant px-sm py-2xs"}
				>
					<Text className={canSchedule ? "text-label text-on-primary" : "text-label text-on-surface-variant"}>
						Schedule
					</Text>
				</Pressable>
			</View>
			<Pressable onPress={onDone} className="self-end rounded-md px-sm py-2xs active:bg-surface-container">
				<Text className="text-label text-on-surface-variant">Close</Text>
			</Pressable>
		</View>
	)
}

function Choice({ onPress, children }) {
	return (
		<Pressable onPress={onPress} className="rounded-sm bg-surface-container-high px-2xs py-3xs active:opacity-80">
			<Text className="text-label text-on-surface-variant">{children}</Text>
		</Pressable>
	)
}
