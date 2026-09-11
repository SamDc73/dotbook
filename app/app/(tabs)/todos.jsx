import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useSQLiteContext } from "expo-sqlite"
import { useCallback, useState } from "react"
import { KeyboardAvoidingView, Platform, Pressable, SectionList, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { ScreenHeader } from "../components/ScreenHeader"
import { TodoEditor } from "../components/TodoEditor"
import { TodoRow } from "../components/TodoRow"
import { Badge } from "../components/ui/Badge"
import { Input } from "../components/ui/Input"
import { Text } from "../components/ui/Text"
import { activeTodoId, addTodo, closedTodos, closeTodo, openTodos, setActiveTodo } from "../db/todos"
import { useLiveQuery } from "../db/use-live-query"
import { shiftDay, today } from "../lib/day"

const ACTIVE_QUERY = ["active-todo"]
const DUE_CHOICES = ["queue", "today", "tomorrow"]

// Three places a todo can live — a date, today, or the queue — and two ways to
// close. Overdue items surface at the top of every later day until closed; the
// queue asks nothing of you. See V0.1 → feature 17.
export default function Todos() {
	const db = useSQLiteContext()
	const queryClient = useQueryClient()
	const insets = useSafeAreaInsets()
	const day = today()
	const [editingId, setEditingId] = useState(null)
	const [showClosed, setShowClosed] = useState(false)
	const [text, setText] = useState("")
	const [due, setDue] = useState("queue")

	// The todo a `/timer` attaches to. Lives in kv-store; read here, changed only
	// through `activate`, which updates the cache in the same step.
	const { data: activeId = null } = useQuery({ queryKey: ACTIVE_QUERY, queryFn: activeTodoId })
	const open = useLiveQuery(["todos", "open", day], () => openTodos(db, day))
	const closed = useLiveQuery(["todos", "closed"], () => closedTodos(db), { enabled: showClosed })

	const sections = [
		// `filter` already made a fresh array, so sorting it in place mutates nothing shared.
		{ title: "Late", data: open.filter((todo) => todo.days_late > 0).sort((a, b) => b.days_late - a.days_late) },
		{ title: "Today", data: open.filter((todo) => todo.due_on === day) },
		{ title: "Later", data: open.filter((todo) => todo.due_on > day) },
		{ title: "Queue", data: open.filter((todo) => todo.due_on === null) },
		{ title: "Closed", data: showClosed ? closed : [] },
	].filter((section) => section.data.length > 0)

	function toggleClosed() {
		setShowClosed((shown) => !shown)
	}
	function stopEditing() {
		setEditingId(null)
	}

	// Stable handlers: TodoRow is memoised. State they need is read at call time
	// (functional updates, the query cache), so none of them closes over it.
	const startEditing = useCallback((todo) => {
		setEditingId((current) => (todo.id === current ? null : todo.id))
	}, [])
	const close = useCallback(
		(todo, status) => {
			closeTodo(db, todo, status, day)
			if (queryClient.getQueryData(ACTIVE_QUERY) === todo.id) {
				setActiveTodo(null)
				queryClient.setQueryData(ACTIVE_QUERY, null)
			}
		},
		[db, day, queryClient]
	)
	// One todo is worked on at a time; tapping the active one clears it.
	const activate = useCallback(
		(todo) => {
			const next = queryClient.getQueryData(ACTIVE_QUERY) === todo.id ? null : todo.id
			setActiveTodo(next)
			queryClient.setQueryData(ACTIVE_QUERY, next)
		},
		[queryClient]
	)

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
		return (
			<Text variant="eyebrow" className="bg-background px-md pt-md pb-xs">
				{section.title}
			</Text>
		)
	}

	return (
		<KeyboardAvoidingView
			behavior={Platform.OS === "ios" ? "padding" : "height"}
			className="flex-1 bg-background"
			style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
		>
			<ScreenHeader title="Todos" lede="A date, today, or the queue — and it never nags" />
			<SectionList
				sections={sections}
				keyExtractor={keyOf}
				renderItem={renderItem}
				renderSectionHeader={renderSectionHeader}
				ItemSeparatorComponent={Seam}
				contentContainerClassName="px-md"
				keyboardShouldPersistTaps="handled"
				ListFooterComponent={
					<Pressable onPress={toggleClosed} className="self-start py-md">
						<Text variant="label" className="font-body-medium text-primary">
							{showClosed ? "Hide closed" : "Show closed"}
						</Text>
					</Pressable>
				}
			/>
			<View className="flex-row items-center gap-xs border-t border-outline-variant bg-surface px-md py-sm">
				<Input
					className="flex-1"
					value={text}
					onChangeText={setText}
					onSubmitEditing={add}
					submitBehavior="submit"
					placeholder="call the dentist"
				/>
				{DUE_CHOICES.map((choice) => (
					<Badge key={choice} variant={choice === due ? "primary" : "surface"} onPress={() => setDue(choice)}>
						{choice}
					</Badge>
				))}
			</View>
		</KeyboardAvoidingView>
	)
}

function keyOf(todo) {
	return todo.id
}

function Seam() {
	return <View className="border-b border-dashed border-outline-variant" />
}
