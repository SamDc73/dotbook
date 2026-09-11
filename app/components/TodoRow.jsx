import { useSQLiteContext } from "expo-sqlite"
import { Square, SquareCheck, SquareDashed, Trash } from "lucide-react-native"
import { useCallback, useState } from "react"
import { Pressable, Text, View } from "react-native"
import { linkedEntries } from "../db/todos"
import { useLiveQuery } from "../db/use-live-query"
import { Icon } from "./ui/Icon"

// One todo. Shape carries the state — filled box done, dashed box trashed — so
// it survives with colour removed. A chip only appears when it has something to
// say: late, scheduled, or time spent. Unscheduled todos show nothing.
export function TodoRow({ todo, today, onClose, onEdit, editor = null }) {
	const db = useSQLiteContext()
	const [showLines, setShowLines] = useState(false)
	const open = todo.status === "open"

	const query = useCallback(
		() => (showLines ? linkedEntries(db, todo.id) : Promise.resolve([])),
		[db, todo.id, showLines]
	)
	const lines = useLiveQuery(db, query)

	function done() {
		onClose(todo, "done")
	}
	function trash() {
		onClose(todo, "trashed")
	}
	function edit() {
		onEdit(todo)
	}
	function toggleLines() {
		setShowLines(!showLines)
	}

	return (
		<View>
			<View className="flex-row items-start gap-sm px-md py-xs">
				<Pressable onPress={done} disabled={!open} className="pt-3xs" accessibilityLabel="Done">
					<Icon as={boxFor(todo.status)} className={open ? "text-on-surface-variant" : "text-success"} />
				</Pressable>
				<Pressable onPress={edit} disabled={!open} className="flex-1 gap-2xs">
					<Text
						className={
							todo.status === "trashed" ? "text-body text-on-surface-variant line-through" : "text-body text-on-surface"
						}
					>
						{todo.text}
					</Text>
					{open ? (
						<View className="flex-row flex-wrap gap-xs">
							{todo.days_late > 0 && (
								<Chip className="bg-error-container text-on-error-container">{lateLabel(todo.days_late)}</Chip>
							)}
							{todo.due_on > today && (
								<Chip className="bg-surface-container-high text-on-surface-variant">{todo.due_on}</Chip>
							)}
							{todo.planned_start !== null && (
								<Chip className="bg-primary-container text-on-primary-container">{windowLabel(todo, today)}</Chip>
							)}
							{todo.spent_ms > 0 && (
								<Pressable onPress={toggleLines}>
									<Chip className="bg-surface-container-high text-on-surface-variant">{spentLabel(todo.spent_ms)}</Chip>
								</Pressable>
							)}
						</View>
					) : null}
				</Pressable>
				{open ? (
					<Pressable onPress={trash} className="pt-3xs" accessibilityLabel="Trash">
						<Icon as={Trash} className="text-on-surface-variant" />
					</Pressable>
				) : null}
			</View>
			{showLines
				? lines.map((line) => (
						<Text key={line.id} className="px-xl py-2xs text-label text-on-surface-variant">
							{line.text}
						</Text>
					))
				: null}
			{editor}
		</View>
	)
}

function Chip({ className, children }) {
	return <Text className={`rounded-sm px-2xs text-label ${className}`}>{children}</Text>
}

function boxFor(status) {
	if (status === "done") return SquareCheck
	if (status === "trashed") return SquareDashed
	return Square
}

// `yesterday`, `3d late`
function lateLabel(daysLate) {
	if (daysLate === 1) return "yesterday"
	return `${daysLate}d late`
}

// `Today 15:30 → 16:00`, `Thu 15:30 → 16:00`. Read live from the linked plan line.
function windowLabel(todo, today) {
	const when =
		todo.planned_day === today
			? "Today"
			: new Date(`${todo.planned_day}T12:00`).toLocaleDateString(undefined, { weekday: "short" })
	if (todo.planned_end === null) return `${when} ${clock(todo.planned_start)}`
	return `${when} ${clock(todo.planned_start)} → ${clock(todo.planned_end)}`
}

// `1h 12m`, `45m`
function spentLabel(ms) {
	const minutes = Math.round(ms / 60000)
	const hours = Math.floor(minutes / 60)
	if (hours === 0) return `${minutes}m`
	return `${hours}h ${minutes % 60}m`
}

function clock(epochMs) {
	const at = new Date(epochMs)
	return `${at.getHours()}:${String(at.getMinutes()).padStart(2, "0")}`
}
