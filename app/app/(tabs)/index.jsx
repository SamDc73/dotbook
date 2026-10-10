import { parseLineTime } from "@dotbook/core/parse"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useLocalSearchParams, useRouter } from "expo-router"
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
import { addEntry, confirmPlan, deleteEntry, entriesForDay, restoreEntry } from "../../db/entries"
import { materializeDay } from "../../db/recurrences"
import { abandonTimer, restoreTimer, stopTimer } from "../../db/timers"
import { closeTodo, mergeTodosIntoLog, reopenTodo, todosForDay } from "../../db/todos"
import { useLiveQuery } from "../../db/use-live-query"
import { shiftDay, today } from "../../lib/day"
import { clock } from "../../lib/format"
import { tap } from "../../lib/haptics"
import { offerUndo } from "../../lib/undo"
import { useDayNav } from "../../lib/use-day-nav"
import { useToday } from "../../lib/use-today"
import { saveVoiceNote } from "../../voice/notes"

const ORDER_KEY = "entry-order" // "typing" | "chronological"
const ORDER_QUERY = ["pref", ORDER_KEY]

export default function Today() {
	const db = useSQLiteContext()
	const queryClient = useQueryClient()
	const insets = useSafeAreaInsets()
	// The day shown is the one picked, or today when none is: left on today, the
	// log moves to the new day at midnight and when the app is opened next morning.
	const current = useToday()
	const [picked, setPicked] = useState(null)
	const day = picked ?? current
	// The one line being edited in place, by id — its row holds the input.
	const [editingId, setEditingId] = useState(null)
	const list = useRef(null)
	const composer = useRef(null)
	// Set when the composer opens a list; the next layout of the log scrolls it into view.
	const revealing = useRef(false)

	const { data: order = "typing" } = useQuery({
		queryKey: ORDER_QUERY,
		queryFn: () => Storage.getItemAsync(ORDER_KEY).then((saved) => saved ?? "typing"),
	})
	const entries = useLiveQuery(["entries", day, order], () => entriesForDay(db, day, order))
	// The day's todos sit in the log as lines with a box where the pill would be;
	// today's finished ones stay, struck, and are gone from tomorrow's log.
	const todos = useLiveQuery(["todos", "day", day, current], () => todosForDay(db, day, current))
	const items = mergeTodosIntoLog(entries, todos)

	// Moving between days: the headline's gestures and keys land here, and a
	// day is materialised the moment it is looked at.
	const pick = useCallback(
		(next) => {
			materializeDay(db, next)
			setPicked(followToday(next))
		},
		[db]
	)
	const shift = useCallback((delta) => setPicked((shown) => followToday(shiftDay(shown ?? today(), delta))), [])
	const pan = useDayNav(shift)

	// `dotbook:///?compose=1` — the home-screen widget and the quick-settings
	// tile — opens today with the cursor in the composer, however the app was left.
	const { compose } = useLocalSearchParams()
	const router = useRouter()
	useEffect(() => {
		if (compose === undefined) return
		setPicked(null)
		composer.current?.focus()
		router.setParams({ compose: undefined })
	}, [compose, router])
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
		// Read today now, not at the last render: a line typed in the minute after
		// midnight belongs to the new day.
		const target = picked ?? today()
		const stamped = stampedNow(text, target)
		const id = await addEntry(db, { day: target, ...stamped, source: voice ? "voice" : "manual" })
		if (voice?.uri) await saveVoiceNote(db, { entryId: id, ...voice })
		// The composer is the log's last row: keep it in view as the log grows.
		list.current?.scrollToEnd({ animated: true })
	}

	function markRevealing() {
		revealing.current = true
	}
	function reveal() {
		if (!revealing.current) return
		revealing.current = false
		list.current?.scrollToEnd({ animated: true })
	}

	// The row handlers are stable so the memoised EntryLine rows only re-render
	// when their own entry changes — a ticking timer row does not redraw the log.
	const remove = useCallback(
		(entry) => {
			if (entry.kind === "timer") {
				abandonTimer(db, entry)
				offerUndo("Timer abandoned", () => restoreTimer(db, entry))
			} else {
				deleteEntry(db, entry.id)
				offerUndo("Line deleted", () => restoreEntry(db, entry.id))
			}
			setEditingId((current) => (current === entry.id ? null : current))
		},
		[db]
	)
	const edit = useCallback((entry) => setEditingId(entry.id), [])
	const edited = useCallback(() => setEditingId(null), [])
	const confirm = useCallback((entry) => confirmPlan(db, entry.id), [db])
	const stop = useCallback((entry) => stopTimer(db, entry), [db])
	const closeOne = useCallback(
		async (todo, status) => {
			const lineId = await closeTodo(db, todo, status, today())
			if (status === "done") tap("done")
			offerUndo(status === "done" ? "Todo done" : "Todo trashed", () => reopenTodo(db, todo.id, lineId))
		},
		[db]
	)
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
					className="rounded-full p-xs active:bg-surface-container"
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
					onContentSizeChange={reveal}
					ListFooterComponent={
						<Composer
							day={day}
							seam={items.length > 0}
							onSubmit={submit}
							onListOpen={markRevealing}
							inputRef={composer}
						/>
					}
				/>
			</View>
			<StatusBar style="auto" />
		</KeyboardAvoidingView>
	)
}

// Picking today means following it, so it rolls over at midnight.
function followToday(day) {
	return day === today() ? null : day
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
