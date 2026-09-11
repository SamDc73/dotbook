import { parseLineTime } from "@dotbook/core/parse"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useSQLiteContext } from "expo-sqlite"
import Storage from "expo-sqlite/kv-store"
import { StatusBar } from "expo-status-bar"
import { useCallback, useEffect, useState } from "react"
import { KeyboardAvoidingView, Platform } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Composer } from "../components/Composer"
import { DayHeader } from "../components/DayHeader"
import { EntryLine } from "../components/EntryLine"
import { LogList } from "../components/LogList"
import { addEntry, confirmPlan, deleteEntry, entriesForDay, updateEntryText } from "../db/entries"
import { materializeDay } from "../db/recurrences"
import { abandonTimer, startTimer, stopTimer } from "../db/timers"
import { useLiveQuery } from "../db/use-live-query"
import { shiftDay, today } from "../lib/day"
import { clock } from "../lib/format"
import { saveVoiceNote } from "../voice/notes"

const ORDER_KEY = "entry-order" // "typing" | "chronological"
const ORDER_QUERY = ["pref", ORDER_KEY]

export default function Today() {
	const db = useSQLiteContext()
	const queryClient = useQueryClient()
	const insets = useSafeAreaInsets()
	const [day, setDay] = useState(today)
	const [editing, setEditing] = useState(null) // the entry loaded into the composer

	const { data: order = "typing" } = useQuery({
		queryKey: ORDER_QUERY,
		queryFn: () => Storage.getItemAsync(ORDER_KEY).then((saved) => saved ?? "typing"),
	})
	const entries = useLiveQuery(["entries", day, order], () => entriesForDay(db, day, order))

	// Recurring rules become lines the first time a day is looked at. Today's on
	// open; any other day when it is navigated to (in `shift`, the interaction).
	useEffect(() => {
		materializeDay(db, today())
	}, [db])

	function shift(delta) {
		const next = shiftDay(day, delta)
		materializeDay(db, next)
		setDay(next)
	}

	function toggleOrder() {
		const next = order === "chronological" ? "typing" : "chronological"
		queryClient.setQueryData(ORDER_QUERY, next)
		Storage.setItemAsync(ORDER_KEY, next)
	}

	// `voice` is set when the line was transcribed: the row is marked `source: voice`
	// and the recording, when the platform could keep one, is saved against it.
	async function submit(text, voice) {
		if (editing) {
			if (text !== "") updateEntryText(db, editing.id, text, editing.day)
			setEditing(null)
			return
		}
		if (text === "") return
		const stamped = stampedNow(text, day)
		const id = await addEntry(db, { day, ...stamped, source: voice ? "voice" : "manual" })
		if (voice?.uri) await saveVoiceNote(db, { entryId: id, ...voice })
	}

	// The row handlers are stable so the memoised EntryLine rows only re-render
	// when their own entry changes — a ticking timer row does not redraw the log.
	const remove = useCallback(
		(entry) => {
			if (entry.kind === "timer") abandonTimer(db, entry)
			else deleteEntry(db, entry.id)
			setEditing((current) => (current?.id === entry.id ? null : current))
		},
		[db]
	)
	const confirm = useCallback((entry) => confirmPlan(db, entry.id), [db])
	const stop = useCallback((entry) => stopTimer(db, entry), [db])
	const renderEntry = useCallback(
		({ item }) => (
			<EntryLine entry={item} onPress={setEditing} onLongPress={remove} onConfirm={confirm} onStop={stop} />
		),
		[remove, confirm, stop]
	)

	function timer(minutes, text) {
		startTimer(db, { minutes, text })
	}

	return (
		<KeyboardAvoidingView
			behavior={Platform.OS === "ios" ? "padding" : "height"}
			className="flex-1 bg-background"
			style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
		>
			<DayHeader day={day} order={order} onShiftDay={shift} onToggleOrder={toggleOrder} />
			<LogList
				data={entries}
				keyExtractor={keyOf}
				renderItem={renderEntry}
				contentContainerClassName="py-sm"
				keyboardShouldPersistTaps="handled"
			/>
			<Composer
				key={editing?.id ?? "new"}
				day={day}
				defaultText={editing?.text ?? ""}
				editing={editing !== null}
				onSubmit={submit}
				onTimer={timer}
			/>
			<StatusBar style="auto" />
		</KeyboardAvoidingView>
	)
}

function keyOf(entry) {
	return entry.id
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
