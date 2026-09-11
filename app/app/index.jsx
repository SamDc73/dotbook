import { useSQLiteContext } from "expo-sqlite"
import Storage from "expo-sqlite/kv-store"
import { StatusBar } from "expo-status-bar"
import { useCallback, useEffect, useState } from "react"
import { FlatList, KeyboardAvoidingView, Platform } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Composer } from "../components/Composer"
import { DayHeader } from "../components/DayHeader"
import { EntryLine } from "../components/EntryLine"
import { addEntry, deleteEntry, entriesForDay, updateEntryText } from "../db/entries"
import { useLiveQuery } from "../db/use-live-query"
import { shiftDay, today } from "../lib/day"

const ORDER_KEY = "entry-order" // "typing" | "chronological"

export default function Today() {
	const db = useSQLiteContext()
	const insets = useSafeAreaInsets()
	const [day, setDay] = useState(today)
	const [order, setOrder] = useState("typing")
	const [editing, setEditing] = useState(null) // the entry loaded into the composer

	useEffect(() => {
		Storage.getItemAsync(ORDER_KEY).then((saved) => saved && setOrder(saved))
	}, [])

	const query = useCallback(() => entriesForDay(db, day, order), [db, day, order])
	const entries = useLiveQuery(db, query)

	function shift(delta) {
		setDay(shiftDay(day, delta))
	}

	function toggleOrder() {
		const next = order === "chronological" ? "typing" : "chronological"
		setOrder(next)
		Storage.setItemAsync(ORDER_KEY, next)
	}

	function submit(text) {
		if (editing) {
			if (text !== "") updateEntryText(db, editing.id, text, editing.day)
			setEditing(null)
			return
		}
		if (text !== "") addEntry(db, { day, text })
	}

	function remove(entry) {
		deleteEntry(db, entry.id)
		if (editing?.id === entry.id) setEditing(null)
	}

	function renderEntry({ item }) {
		return <EntryLine entry={item} onPress={setEditing} onLongPress={remove} />
	}

	return (
		<KeyboardAvoidingView
			behavior={Platform.OS === "ios" ? "padding" : "height"}
			className="flex-1 bg-background"
			style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
		>
			<DayHeader day={day} order={order} onShiftDay={shift} onToggleOrder={toggleOrder} />
			<FlatList
				data={entries}
				keyExtractor={(entry) => entry.id}
				renderItem={renderEntry}
				contentContainerClassName="py-sm"
				keyboardShouldPersistTaps="handled"
			/>
			<Composer
				key={editing?.id ?? "new"}
				defaultText={editing?.text ?? ""}
				editing={editing !== null}
				onSubmit={submit}
			/>
			<StatusBar style="auto" />
		</KeyboardAvoidingView>
	)
}
