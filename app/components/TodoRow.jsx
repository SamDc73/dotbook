import { useSQLiteContext } from "expo-sqlite"
import Play from "lucide-react-native/icons/play"
import Square from "lucide-react-native/icons/square"
import SquareCheck from "lucide-react-native/icons/square-check"
import SquareDashed from "lucide-react-native/icons/square-dashed"
import Trash from "lucide-react-native/icons/trash"
import { memo, useState } from "react"
import { Pressable, View } from "react-native"
import { linkedEntries, proposedLinks } from "../db/todos"
import { useLiveQuery } from "../db/use-live-query"
import { clock, minutesLabel, weekday } from "../lib/format"
import { TodoProposals } from "./TodoProposals"
import { Badge } from "./ui/Badge"
import { Icon } from "./ui/Icon"
import { Text } from "./ui/Text"

// One todo. Shape carries the state — filled box done, dashed box trashed — so
// it survives with colour removed. A chip only appears when it has something to
// say: late, scheduled, time spent, being worked on, or lines that look like it.
// Unscheduled todos show nothing. Memoised: it sits in a list.
export const TodoRow = memo(function TodoRow({
	todo,
	today,
	active = false,
	onClose,
	onEdit,
	onActivate,
	editor = null,
}) {
	const db = useSQLiteContext()
	const [showLines, setShowLines] = useState(false)
	const [showProposals, setShowProposals] = useState(false)
	const open = todo.status === "open"

	const lines = useLiveQuery(["todo-lines", todo.id], () => linkedEntries(db, todo.id), { enabled: showLines })
	// Kept live so the count drops as proposals are answered; re-runs when the
	// database changes or the todo's text does, not on every render.
	const proposals = useLiveQuery(["todo-proposals", todo.id, todo.text], () => proposedLinks(db, todo), {
		enabled: open,
	})

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
		setShowLines((shown) => !shown)
	}
	function toggleProposals() {
		setShowProposals((shown) => !shown)
	}
	function activate() {
		onActivate(todo)
	}

	return (
		<View>
			<View className="flex-row items-start gap-sm py-xs">
				<Pressable onPress={done} disabled={!open} className="pt-3xs" accessibilityLabel="Done">
					<Icon as={boxFor(todo.status)} className={open ? "text-on-surface-variant" : "text-success"} />
				</Pressable>
				<Pressable onPress={edit} disabled={!open} className="flex-1 gap-2xs">
					<Text
						variant="line"
						className={todo.status === "trashed" ? "text-on-surface-variant line-through" : undefined}
					>
						{todo.text}
					</Text>
					{open ? (
						<View className="flex-row flex-wrap gap-xs">
							{todo.days_late > 0 ? <Badge variant="error">{lateLabel(todo.days_late)}</Badge> : null}
							{todo.due_on > today ? <Badge variant="surface">{todo.due_on}</Badge> : null}
							{todo.planned_start !== null ? <Badge variant="primary">{windowLabel(todo, today)}</Badge> : null}
							{todo.spent_ms > 0 ? (
								<Badge variant="surface" onPress={toggleLines}>
									{minutesLabel(todo.spent_ms)}
								</Badge>
							) : null}
							{active ? <Badge variant="primary">working on it</Badge> : null}
							{proposals.length > 0 ? (
								<Badge variant="tertiary" onPress={toggleProposals}>
									{proposals.length} proposed
								</Badge>
							) : null}
						</View>
					) : null}
				</Pressable>
				{open ? (
					<Pressable
						onPress={activate}
						className="pt-3xs"
						accessibilityLabel={active ? "Stop working on it" : "Work on it"}
					>
						<Icon as={Play} className={active ? "text-primary" : "text-on-surface-variant"} />
					</Pressable>
				) : null}
				{open ? (
					<Pressable onPress={trash} className="pt-3xs" accessibilityLabel="Trash">
						<Icon as={Trash} className="text-on-surface-variant" />
					</Pressable>
				) : null}
			</View>
			{showProposals && proposals.length > 0 ? <TodoProposals todo={todo} proposals={proposals} /> : null}
			{showLines
				? lines.map((line) => (
						<Text key={line.id} variant="data" className="px-xl py-2xs">
							{line.text}
						</Text>
					))
				: null}
			{editor}
		</View>
	)
})

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
	const when = todo.planned_day === today ? "Today" : weekday(todo.planned_day)
	if (todo.planned_end === null) return `${when} ${clock(todo.planned_start)}`
	return `${when} ${clock(todo.planned_start)} → ${clock(todo.planned_end)}`
}
