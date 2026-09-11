import { parseLineTime } from "@dotbook/core/parse"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useSQLiteContext } from "expo-sqlite"
import Storage from "expo-sqlite/kv-store"
import { StatusBar } from "expo-status-bar"
import Clock from "lucide-react-native/icons/clock"
import List from "lucide-react-native/icons/list"
import { useCallback, useEffect, useRef, useState } from "react"
import { KeyboardAvoidingView, Platform, Pressable, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Composer } from "../../components/Composer"
import { DateHeadline } from "../../components/DateHeadline"
import { EntryLine } from "../../components/EntryLine"
import { LogList } from "../../components/LogList"
import { TodoLine } from "../../components/TodoLine"
import { Icon } from "../../components/ui/Icon"
import { addEntry, confirmPlan, deleteEntry, entriesForDay } from "../../db/entries"
import { materializeDay } from "../../db/recurrences"
import { abandonTimer, stopTimer } from "../../db/timers"
import { closeTodo, mergeTodosIntoLog, todosForDay } from "../../db/todos"
import { useLiveQuery } from "../../db/use-live-query"
import { shiftDay, today } from "../../lib/day"
import { clock } from "../../lib/format"
import { useDayNav } from "../../lib/use-day-nav"
import { saveVoiceNote } from "../../voice/notes"

const ORDER_KEY = "entry-order" // "typing" | "chronological"
const ORDER_QUERY = ["pref", ORDER_KEY]

export default function Today() {
	const db = useSQLiteContext()
	const queryClient = useQueryClient()
	const insets = useSafeAreaInsets()
	const [day, setDay] = useState(today)
	// The one line being edited in place, by id — its row holds the input.
	const [editingId, setEditingId] = useState(null)
	const list = useRef(null)

	const { data: order = "typing" } = useQuery({
		queryKey: ORDER_QUERY,
		queryFn: () => Storage.getItemAsync(ORDER_KEY).then((saved) => saved ?? "typing"),
	})
	const entries = useLiveQuery(["entries", day, order], () => entriesForDay(db, day, order))
	// The day's todos sit in the log as lines with a box where the pill would be;
	// today's finished ones stay, struck, and are gone from tomorrow's log.
	const todos = useLiveQuery(["todos", "day", day], () => todosForDay(db, day, today()))
	const items = mergeTodosIntoLog(entries, todos)

	// Moving between days: the headline's gestures and keys land here, and a
	// day is materialised the moment it is looked at.
	const pick = useCallback(
		(next) => {
			materializeDay(db, next)
			setDay(next)
		},
		[db]
	)
	const shift = useCallback((delta) => setDay((current) => shiftDay(current, delta)), [])
	const pan = useDayNav(shift)
	useEffect(() => {
		materializeDay(db, day)
	}, [db, day])

	function toggleOrder() {
		const next = order === "chronological" ? "typing" : "chronological"
		queryClient.setQueryData(ORDER_QUERY, next)
		Storage.setItemAsync(ORDER_KEY, next)
	}

	// `voice` is set when the line was transcribed: the row is marked `source: voice`
	// and the recording, when the platform could keep one, is saved against it.
	async function submit(text, voice) {
		if (text === "") return
		const stamped = stampedNow(text, day)
		const id = await addEntry(db, { day, ...stamped, source: voice ? "voice" : "manual" })
		if (voice?.uri) await saveVoiceNote(db, { entryId: id, ...voice })
		// The composer is the log's last row: keep it in view as the log grows.
		list.current?.scrollToEnd({ animated: true })
	}

	// The row handlers are stable so the memoised EntryLine rows only re-render
	// when their own entry changes — a ticking timer row does not redraw the log.
	const remove = useCallback(
		(entry) => {
			if (entry.kind === "timer") abandonTimer(db, entry)
			else deleteEntry(db, entry.id)
			setEditingId((current) => (current === entry.id ? null : current))
		},
		[db]
	)
	const edit = useCallback((entry) => setEditingId(entry.id), [])
	const edited = useCallback(() => setEditingId(null), [])
	const confirm = useCallback((entry) => confirmPlan(db, entry.id), [db])
	const stop = useCallback((entry) => stopTimer(db, entry), [db])
	const closeOne = useCallback((todo, status) => closeTodo(db, todo, status, today()), [db])
	const renderItem = useCallback(
		({ item }) => {
			if (item.kind === "todo") return <TodoLine todo={item} onClose={closeOne} />
			return (
				<EntryLine
					entry={item}
					editing={item.id === editingId}
					onEdit={edit}
					onEdited={edited}
					onLongPress={remove}
					onConfirm={confirm}
					onStop={stop}
				/>
			)
		},
		[editingId, edit, edited, remove, confirm, stop, closeOne]
	)

	return (
		<KeyboardAvoidingView
			behavior={Platform.OS === "ios" ? "padding" : "height"}
			className="flex-1 bg-background"
			style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
		>
			<DateHeadline day={day} onShift={shift} onPick={pick}>
				<Pressable
					onPress={toggleOrder}
					className="rounded-md p-xs active:bg-surface-container"
					accessibilityLabel={`Order: ${order}`}
				>
					<Icon as={order === "chronological" ? Clock : List} className="text-primary" />
				</Pressable>
			</DateHeadline>
			<View className="flex-1" {...pan.panHandlers}>
				<LogList
					ref={list}
					data={items}
					keyExtractor={keyOf}
					renderItem={renderItem}
					contentContainerClassName="py-sm"
					keyboardShouldPersistTaps="handled"
					ListFooterComponent={<Composer day={day} seam={items.length > 0} onSubmit={submit} />}
				/>
			</View>
			<StatusBar style="auto" />
		</KeyboardAvoidingView>
	)
}

// Todos and entries share the list; their ids come from different tables.
function keyOf(item) {
	return item.kind === "todo" ? `todo:${item.id}` : item.id
}

// A line typed today without a time is stamped with the current one — the time
// is the bullet, so every line gets one. It is written into the text itself,
// exactly as if it had been typed, so the row stays a plain line; `stampedAt`
// remembers that the app did it (kept, not shown). Lines for other days and
// `/` commands are left as they are: "now" means nothing there.
function stampedNow(text, day) {
	const now = Date.now()
	if (text.startsWith("/") || day !== today() || parseLineTime(text, day, now).timeText !== "") {
		return { text, stampedAt: null }
	}
	return { text: `${clock(now)} ${text}`, stampedAt: now }
}
