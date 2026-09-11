import { parseLineTime } from "@dotbook/core/parse"
import { useRouter } from "expo-router"
import Square from "lucide-react-native/icons/square"
import SquareCheck from "lucide-react-native/icons/square-check"
import SquareDashed from "lucide-react-native/icons/square-dashed"
import { memo } from "react"
import { Pressable } from "react-native"
import { clock } from "../lib/format"
import { TimePill } from "./TimePill"
import { Badge } from "./ui/Badge"
import { Icon } from "./ui/Icon"
import { Text } from "./ui/Text"

// A todo in the Today log. An open one sits at the top of the day with an empty
// box where the time pill would be — tap the box to finish it, hold the row to
// trash it, tap the text to open the todos screen. It says when it is late, and
// its window only when it is planned. Once closed it is no longer this row: it
// becomes the `done:` / `trashed:` line `closeTodo` writes, drawn by DoneLine
// below — struck, with the box filled or dashed — and gone with that day.
export const TodoLine = memo(function TodoLine({ todo, onClose }) {
	const router = useRouter()

	function done() {
		onClose(todo, "done")
	}
	function trash() {
		onClose(todo, "trashed")
	}
	function open() {
		router.push("/todos")
	}

	return (
		<Pressable onLongPress={trash} className="flex-row items-baseline gap-sm py-xs active:bg-surface-container">
			<Pressable onPress={done} accessibilityLabel={`Done: ${todo.text}`} className="self-center">
				<Icon as={Square} className="text-on-surface-variant" />
			</Pressable>
			{todo.planned_start !== null ? <TimePill {...pillFor(todo.planned_start, todo.planned_end)} /> : null}
			<Pressable onPress={open} className="flex-1">
				<Text variant="line">{todo.text}</Text>
			</Pressable>
			{todo.days_late > 0 ? <Badge variant="error">{lateLabel(todo.days_late)}</Badge> : null}
		</Pressable>
	)
})

// The line a closed todo left in the log: `21:14 done: write report`. The word
// is the box, the text is struck — today's todos crossed off, for the record.
export const DoneLine = memo(function DoneLine({ entry, hour, endHour }) {
	const { timeText, body } = parseLineTime(entry.text, entry.day)
	const [, status, text] = /^(done|trashed):\s*(.*)$/.exec(body) ?? [null, "done", body]
	return (
		<Pressable
			className="flex-row items-baseline gap-sm py-xs"
			accessibilityLabel={`${status}: ${text}`}
			accessibilityRole="text"
		>
			<Icon as={status === "trashed" ? SquareDashed : SquareCheck} className="self-center text-success" />
			{timeText !== "" ? <TimePill timeText={timeText} hour={hour} endHour={endHour} /> : null}
			<Text variant="line" className="flex-1 text-on-surface-variant line-through">
				{text}
			</Text>
		</Pressable>
	)
})

// The planned window as the pill draws it, from the linked plan line's instants.
function pillFor(start, end) {
	const timeText = end === null ? clock(start) : `${clock(start)} -> ${clock(end)}`
	return { timeText, hour: hourOf(start), endHour: hourOf(end) }
}

function hourOf(ts) {
	if (ts === null) return null
	return String(new Date(ts).getHours()).padStart(2, "0")
}

// `yesterday`, `3d late`
function lateLabel(daysLate) {
	if (daysLate === 1) return "yesterday"
	return `${daysLate}d late`
}
