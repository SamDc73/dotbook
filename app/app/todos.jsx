import { useRouter } from "expo-router"
import { useSQLiteContext } from "expo-sqlite"
import { ChevronLeft } from "lucide-react-native"
import { useCallback, useEffect, useState } from "react"
import { KeyboardAvoidingView, Platform, Pressable, SectionList, Text, TextInput, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { TodoEditor } from "../components/TodoEditor"
import { TodoRow } from "../components/TodoRow"
import { Icon } from "../components/ui/Icon"
import { activeTodoId, addTodo, closedTodos, closeTodo, openTodos, setActiveTodo } from "../db/todos"
import { useLiveQuery } from "../db/use-live-query"
import { shiftDay, today } from "../lib/day"

// Three places a todo can live — a date, today, or the queue — and two ways to
// close. Overdue items surface at the top of every later day until closed; the
// queue asks nothing of you. See V0.1 → feature 17.
export default function Todos() {
	const db = useSQLiteContext()
	const router = useRouter()
	const insets = useSafeAreaInsets()
	const day = today()
	const [editingId, setEditingId] = useState(null)
	const [showClosed, setShowClosed] = useState(false)
	const [text, setText] = useState("")
	const [due, setDue] = useState("queue") // queue | today | tomorrow
	const [activeId, setActiveId] = useState(null) // the todo a `/timer` attaches to

	useEffect(() => {
		activeTodoId().then(setActiveId)
	}, [])

	const openQuery = useCallback(() => openTodos(db, day), [db, day])
	const open = useLiveQuery(db, openQuery)
	const closedQuery = useCallback(() => (showClosed ? closedTodos(db) : Promise.resolve([])), [db, showClosed])
	const closed = useLiveQuery(db, closedQuery)

	const sections = [
		{ title: "Late", data: open.filter((todo) => todo.days_late > 0).sort((a, b) => b.days_late - a.days_late) },
		{ title: "Today", data: open.filter((todo) => todo.due_on === day) },
		{ title: "Later", data: open.filter((todo) => todo.due_on > day) },
		{ title: "Queue", data: open.filter((todo) => todo.due_on === null) },
		{ title: "Closed", data: closed },
	].filter((section) => section.data.length > 0)

	function back() {
		router.back()
	}
	function toggleClosed() {
		setShowClosed(!showClosed)
	}
	function stopEditing() {
		setEditingId(null)
	}
	function startEditing(todo) {
		setEditingId(todo.id === editingId ? null : todo.id)
	}
	function close(todo, status) {
		closeTodo(db, todo, status, day)
		if (todo.id === activeId) setActiveId(null)
	}
	// One todo is worked on at a time; tapping the active one clears it.
	function activate(todo) {
		const next = todo.id === activeId ? null : todo.id
		setActiveTodo(next)
		setActiveId(next)
	}

	function add() {
		if (text.trim() === "") return
		const dueOn = { queue: null, today: day, tomorrow: shiftDay(day, 1) }[due]
		addTodo(db, { text, dueOn })
		setText("")
	}

	function renderItem({ item }) {
		const editor = item.id === editingId ? <TodoEditor todo={item} today={day} onDone={stopEditing} /> : null
		return (
			<TodoRow
				todo={item}
				today={day}
				active={item.id === activeId}
				onClose={close}
				onEdit={startEditing}
				onActivate={activate}
				editor={editor}
			/>
		)
	}
	function renderSectionHeader({ section }) {
		return <Text className="px-md pt-sm pb-2xs text-caption text-on-surface-variant">{section.title}</Text>
	}

	return (
		<KeyboardAvoidingView
			behavior={Platform.OS === "ios" ? "padding" : "height"}
			className="flex-1 bg-background"
			style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
		>
			<View className="flex-row items-center gap-sm bg-surface px-md py-sm">
				<Pressable onPress={back} className="rounded-md p-xs active:bg-surface-container" accessibilityLabel="Back">
					<Icon as={ChevronLeft} className="text-on-surface-variant" />
				</Pressable>
				<Text className="flex-1 text-subheading text-on-surface">Todos</Text>
			</View>
			<SectionList
				sections={sections}
				keyExtractor={(todo) => todo.id}
				renderItem={renderItem}
				renderSectionHeader={renderSectionHeader}
				keyboardShouldPersistTaps="handled"
				ListFooterComponent={
					<Pressable onPress={toggleClosed} className="self-start px-md py-sm">
						<Text className="text-label text-primary">{showClosed ? "Hide closed" : "Show closed"}</Text>
					</Pressable>
				}
			/>
			<View className="flex-row items-center gap-xs bg-surface-container px-md py-sm">
				<TextInput
					className="flex-1 text-body text-on-surface"
					value={text}
					onChangeText={setText}
					onSubmitEditing={add}
					submitBehavior="submit"
					placeholder="call the dentist"
				/>
				<DueChip value="queue" current={due} onPress={setDue} />
				<DueChip value="today" current={due} onPress={setDue} />
				<DueChip value="tomorrow" current={due} onPress={setDue} />
			</View>
		</KeyboardAvoidingView>
	)
}

function DueChip({ value, current, onPress }) {
	const selected = value === current
	function press() {
		onPress(value)
	}
	return (
		<Pressable
			onPress={press}
			className={selected ? "rounded-sm bg-primary-container px-2xs py-3xs" : "rounded-sm px-2xs py-3xs"}
		>
			<Text className={selected ? "text-label text-on-primary-container" : "text-label text-on-surface-variant"}>
				{value}
			</Text>
		</Pressable>
	)
}
