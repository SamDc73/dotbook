import { parseLineTime } from "@dotbook/core/parse"
import { useRouter } from "expo-router"
import Play from "lucide-react-native/icons/play"
import Square from "lucide-react-native/icons/square"
import SquareCheck from "lucide-react-native/icons/square-check"
import SquareDashed from "lucide-react-native/icons/square-dashed"
import { memo } from "react"
import { Pressable } from "react-native"
import { gutter } from "../lib/gutter"
import { TimePill } from "./TimePill"
import { Badge } from "./ui/Badge"
import { Icon } from "./ui/Icon"
import { Text } from "./ui/Text"

// A todo in the Today log. An open one sits at the top of the day with an empty
// box where the time pill would be — tap the box to finish it, hold the row to
// trash it, tap the text to open the todos screen. It says when it is late, its
// window only when it is planned, and `working on it` once a line has started
// it. Once closed it is no longer this row: the line that closed it — typed
// (`anki deck done`) or written by the app (`21:14 done: anki deck`) — stands
// in the log, drawn by DoneLine below, struck, and gone with that day.
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
		<Pressable
			onLongPress={trash}
			className={`${gutter(null)} flex-row items-baseline gap-sm py-xs active:bg-surface-container`}
		>
			<Pressable onPress={done} accessibilityLabel={`Done: ${todo.text}`} className="self-center">
				<Icon as={Square} className="text-on-surface-variant" />
			</Pressable>
			{todo.planned_start !== null ? (
				<TimePill tsStart={todo.planned_start} tsEnd={todo.planned_end} {...hoursFor(todo)} />
			) : null}
			<Pressable onPress={open} className="flex-1">
				<Text variant="line">{todo.text}</Text>
			</Pressable>
			{todo.started_ts !== null ? <Badge variant="primary">working on it</Badge> : null}
			{todo.days_late > 0 ? <Badge variant="error">{lateLabel(todo.days_late)}</Badge> : null}
		</Pressable>
	)
})

// A line that is a todo's moment: the box tells which. Done or trashed —
// whether the app wrote `done: …` or the person typed `anki deck done` — is
// struck; started is not, it is the beginning of the time on it.
export const DoneLine = memo(function DoneLine({ entry, hour, endHour }) {
	const { timeText, body } = parseLineTime(entry.text, entry.day)
	const role = roleOf(entry, body)
	const text = entry.todo_text ?? body.replace(/^(done|trashed|started):\s*/, "")
	const struck = role !== "started"
	return (
		<Pressable
			className={`${gutter(hour)} flex-row items-baseline gap-sm py-xs`}
			accessibilityLabel={`${role === "finished" ? "done" : role}: ${text}`}
			accessibilityRole="text"
		>
			<Icon as={GLYPH[role]} className={role === "started" ? "self-center text-primary" : "self-center text-success"} />
			{timeText !== "" ? (
				<TimePill tsStart={entry.ts_start} tsEnd={entry.ts_end} hour={hour} endHour={endHour} />
			) : null}
			<Text variant="line" className={struck ? "flex-1 text-on-surface-variant line-through" : "flex-1"}>
				{text}
			</Text>
		</Pressable>
	)
})

const GLYPH = { finished: SquareCheck, trashed: SquareDashed, started: Play }

// The role comes from the link the line carries (`entries.todo_role`), or from
// the word the app wrote at its front.
function roleOf(entry, body) {
	if (entry.todo_role) return entry.todo_role
	const word = /^(done|trashed|started):/.exec(body)?.[1] ?? "done"
	return word === "done" ? "finished" : word
}

function hoursFor(todo) {
	return { hour: hourOf(todo.planned_start), endHour: hourOf(todo.planned_end) }
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
