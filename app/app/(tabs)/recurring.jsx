import { partsFromRule } from "@dotbook/core/recurrence"
import * as DocumentPicker from "expo-document-picker"
import { File } from "expo-file-system"
import { useSQLiteContext } from "expo-sqlite"
import { useState } from "react"
import { FlatList, KeyboardAvoidingView, Platform, Pressable, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { RecurrenceForm } from "../../components/RecurrenceForm"
import { ScreenHeader } from "../../components/ScreenHeader"
import { Badge } from "../../components/ui/Badge"
import { Button } from "../../components/ui/Button"
import { Text } from "../../components/ui/Text"
import {
	addRecurrence,
	importIcs,
	recurrences,
	removeRecurrence,
	replaceRecurrence,
	restoreRecurrence,
} from "../../db/recurrences"
import { useLiveQuery } from "../../db/use-live-query"
import { clockAt } from "../../lib/format"
import { offerUndo } from "../../lib/undo"

// The rules behind the lines that fill themselves in: class every Tue/Thu,
// lunch at 5 daily. Tap to edit, long-press to remove, or import a timetable.
export default function Recurring() {
	const db = useSQLiteContext()
	const insets = useSafeAreaInsets()
	const [editing, setEditing] = useState(null) // null | "new" | a rule row
	const [imported, setImported] = useState(null) // what the last .ics import did, as a line

	const rules = useLiveQuery(["recurrences"], () => recurrences(db))

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
		try {
			const text = await readPickedFile()
			if (text === null) return
			const counts = await importIcs(db, text, Intl.DateTimeFormat().resolvedOptions().timeZone)
			setImported(`imported ${counts.rules} rules and ${counts.oneOffs} one-off lines`)
		} catch (error) {
			setImported(`import failed: ${error.message}`)
		}
	}

	function remove(rule) {
		removeRecurrence(db, rule.id)
		offerUndo("Rule removed", () => restoreRecurrence(db, rule.id))
	}

	function renderItem({ item }) {
		return <RuleRow rule={item} onPress={setEditing} onLongPress={remove} />
	}

	const initial = editing === null || editing === "new" ? null : toForm(editing)

	return (
		<KeyboardAvoidingView
			behavior={Platform.OS === "ios" ? "padding" : "height"}
			className="flex-1 bg-background"
			style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
		>
			<ScreenHeader title="Recurring" lede="Rules that write their own lines, ahead of time" />
			<FlatList
				className="flex-1"
				data={rules}
				keyExtractor={keyOf}
				renderItem={renderItem}
				ItemSeparatorComponent={Hairline}
				keyboardShouldPersistTaps="handled"
				contentContainerClassName={
					rules.length === 0
						? "p-md"
						: "m-md overflow-hidden rounded-md border border-outline-variant bg-surface shadow-panel"
				}
				ListEmptyComponent={
					<Text variant="line" className="text-on-surface-variant">
						No rules yet. A class, a standup, rent day: make one, or import a calendar.
					</Text>
				}
				ListFooterComponent={
					imported === null ? null : (
						<Text variant="data" className="px-md py-sm">
							{imported}
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
			<View className="flex-row gap-sm border-t border-outline-variant bg-surface px-md py-sm">
				<Button size="sm" onPress={startNew}>
					<Text>New rule</Text>
				</Button>
				<Button variant="tonal" size="sm" onPress={pickIcs}>
					<Text>Import .ics</Text>
				</Button>
			</View>
		</KeyboardAvoidingView>
	)
}

function keyOf(rule) {
	return rule.id
}

function Hairline() {
	return <View className="border-t border-outline-variant" />
}

function RuleRow({ rule, onPress, onLongPress }) {
	function press() {
		onPress(rule)
	}
	function longPress() {
		onLongPress(rule)
	}
	return (
		<Pressable onPress={press} onLongPress={longPress} className="gap-3xs px-md py-sm active:bg-surface-container">
			<View className="flex-row items-center gap-xs">
				<Text variant="line" className="flex-1">
					{rule.text}
				</Text>
				<Badge variant={rule.kind === "plan" ? "warning" : "surface"} caps>
					{rule.kind}
				</Badge>
				{rule.source === "import:ics" ? (
					<Badge variant="tertiary" caps>
						ics
					</Badge>
				) : null}
			</View>
			<Text variant="data">{describe(rule)}</Text>
		</Pressable>
	)
}

// The rule as a person would say it: `every Tue, Thu at 14:00`, `every 2 weeks on Mon at 9:00`.
function describe(rule) {
	const parts = partsFromRule(rule)
	const at = `at ${clockAt(parts.hour, parts.minute)}`
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
