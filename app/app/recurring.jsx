import { partsFromRule } from "@dotbook/core/recurrence"
import * as DocumentPicker from "expo-document-picker"
import { File } from "expo-file-system"
import { useRouter } from "expo-router"
import { useSQLiteContext } from "expo-sqlite"
import { ChevronLeft } from "lucide-react-native"
import { useCallback, useState } from "react"
import { FlatList, KeyboardAvoidingView, Platform, Pressable, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { RecurrenceForm } from "../components/RecurrenceForm"
import { Icon } from "../components/ui/Icon"
import { addRecurrence, importIcs, recurrences, removeRecurrence, replaceRecurrence } from "../db/recurrences"
import { useLiveQuery } from "../db/use-live-query"

// The rules behind the lines that fill themselves in: class every Tue/Thu,
// lunch at 5 daily. Tap to edit, long-press to remove, or import a timetable.
export default function Recurring() {
	const db = useSQLiteContext()
	const router = useRouter()
	const insets = useSafeAreaInsets()
	const [editing, setEditing] = useState(null) // null | "new" | a rule row
	const [imported, setImported] = useState(null) // { rules, oneOffs } of the last import

	const query = useCallback(() => recurrences(db), [db])
	const rules = useLiveQuery(db, query)

	function back() {
		router.back()
	}
	function startNew() {
		setEditing("new")
	}
	function stopEditing() {
		setEditing(null)
	}

	async function save(fields) {
		if (editing === "new") {
			await addRecurrence(db, fields)
		} else {
			await replaceRecurrence(db, editing.id, fields)
		}
		setEditing(null)
	}

	async function pickIcs() {
		const text = await readPickedFile()
		if (text === null) return
		setImported(await importIcs(db, text, Intl.DateTimeFormat().resolvedOptions().timeZone))
	}

	function renderItem({ item }) {
		return <RuleRow rule={item} onPress={setEditing} onLongPress={(rule) => removeRecurrence(db, rule.id)} />
	}

	const initial = editing === null || editing === "new" ? null : toForm(editing)

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
				<Text className="flex-1 text-subheading text-on-surface">Recurring</Text>
			</View>
			<FlatList
				data={rules}
				keyExtractor={(rule) => rule.id}
				renderItem={renderItem}
				keyboardShouldPersistTaps="handled"
				ListFooterComponent={
					imported === null ? null : (
						<Text className="px-md py-sm text-caption text-on-surface-variant">
							imported {imported.rules} rules and {imported.oneOffs} one-off lines
						</Text>
					)
				}
			/>
			{editing === null ? null : (
				<RecurrenceForm
					key={editing === "new" ? "new" : editing.id}
					initial={initial}
					onSave={save}
					onCancel={stopEditing}
				/>
			)}
			<View className="flex-row gap-xs bg-surface-container px-md py-sm">
				<Pressable onPress={startNew} className="rounded-md bg-primary px-sm py-2xs active:opacity-80">
					<Text className="text-label text-on-primary">New rule</Text>
				</Pressable>
				<Pressable onPress={pickIcs} className="rounded-md bg-secondary-container px-sm py-2xs active:opacity-80">
					<Text className="text-label text-on-secondary-container">Import .ics</Text>
				</Pressable>
			</View>
		</KeyboardAvoidingView>
	)
}

function RuleRow({ rule, onPress, onLongPress }) {
	function press() {
		onPress(rule)
	}
	function longPress() {
		onLongPress(rule)
	}
	return (
		<Pressable onPress={press} onLongPress={longPress} className="gap-3xs px-md py-xs active:bg-surface-container">
			<View className="flex-row items-center gap-xs">
				<Text className="flex-1 text-body text-on-surface">{rule.text}</Text>
				<Text className="text-caption text-on-surface-variant">{rule.kind}</Text>
				{rule.source === "import:ics" ? (
					<Text className="rounded-sm bg-tertiary-container px-2xs text-label text-on-tertiary-container">
						import:ics
					</Text>
				) : null}
			</View>
			<Text className="text-label text-on-surface-variant">{describe(rule)}</Text>
		</Pressable>
	)
}

// The rule as a person would say it: `every Tue, Thu at 14:00`, `every 2 weeks on Mon at 9:00`.
function describe(rule) {
	const parts = partsFromRule(rule)
	const at = `at ${parts.hour}:${String(parts.minute).padStart(2, "0")}`
	const unit = { daily: "day", weekly: "week", monthly: "month" }[parts.freq]
	const every = parts.interval > 1 ? `every ${parts.interval} ${unit}s` : `${parts.freq}`
	const days = parts.byDay.map((code) => DAY_NAME[code.slice(-2)]).join(", ")
	if (parts.freq === "weekly" && days !== "") {
		return parts.interval > 1 ? `${every} on ${days} ${at}` : `every ${days} ${at}`
	}
	if (parts.freq === "monthly") {
		const dayOfMonth = Number(parts.dtstart.slice(-2))
		return `${every} on the ${dayOfMonth}${ordinal(dayOfMonth)} ${at}`
	}
	const span = rule.duration_min ? ` for ${rule.duration_min} min` : ""
	return `${every} ${at}${span}`
}

const DAY_NAME = { MO: "Mon", TU: "Tue", WE: "Wed", TH: "Thu", FR: "Fri", SA: "Sat", SU: "Sun" }

// 1st, 2nd, 3rd, 4th … 11th, 12th, 13th … 21st.
function ordinal(n) {
	if (n % 100 >= 11 && n % 100 <= 13) return "th"
	return { 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th"
}

function toForm(rule) {
	return { text: rule.text, parts: partsFromRule(rule), durationMin: rule.duration_min, kind: rule.kind }
}

// The picked .ics as text, or null when cancelled. On web the picker hands over
// a DOM File; natively it hands over a URI that expo-file-system's File reads.
async function readPickedFile() {
	const result = await DocumentPicker.getDocumentAsync({ type: ["text/calendar", "*/*"], copyToCacheDirectory: true })
	if (result.canceled) return null
	const asset = result.assets[0]
	if (asset.file) return asset.file.text()
	return new File(asset.uri).text()
}
