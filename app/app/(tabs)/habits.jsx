import { effectiveTick } from "@dotbook/core/habits"
import { useSQLiteContext } from "expo-sqlite"
import { useCallback, useState } from "react"
import { FlatList, KeyboardAvoidingView, Platform, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { DateHeadline } from "../../components/DateHeadline"
import { HabitRow } from "../../components/HabitRow"
import { Badge } from "../../components/ui/Badge"
import { Input } from "../../components/ui/Input"
import { addHabit, grid, habits, removeHabit, tick, ticksOn, untick } from "../../db/habits"
import { useLiveQuery } from "../../db/use-live-query"
import { shiftDay, today } from "../../lib/day"
import { useDayNav } from "../../lib/use-day-nav"

const STRIP_DAYS = 14

// Tapping the glyph walks the person's tick through these; `null` means untick.
const NEXT = { pending: "kept", kept: "broken", broken: null }

// One day of habits, in the template's bordered list. The state shown is
// `effectiveTick`: a person's tick wins over the classifier's while it exists.
// Proposals are reviewable here and nowhere else — no badge, no count.
export default function Habits() {
	const db = useSQLiteContext()
	const insets = useSafeAreaInsets()
	const [day, setDay] = useState(today)
	const [name, setName] = useState("")
	const [kind, setKind] = useState("do")

	const stripStart = shiftDay(day, 1 - STRIP_DAYS)
	const list = useLiveQuery(["habits"], () => habits(db))
	const ticks = useLiveQuery(["habit-ticks", day], () => ticksOn(db, day))
	const history = useLiveQuery(["habit-grid", stripStart, day], () => grid(db, stripStart, day))

	// Indexed once per render instead of filtering every row for every habit and day.
	const ticksByHabit = groupBy(ticks, (row) => row.habit_id)
	const historyByHabitDay = groupBy(history, (row) => `${row.habit_id}|${row.day}`)
	const days = Array.from({ length: STRIP_DAYS }, (_, i) => shiftDay(stripStart, i))

	// Same gestures as Today: swipe, arrow keys, hover chevrons, tap the date.
	const shift = useCallback((delta) => setDay((current) => shiftDay(current, delta)), [])
	const pan = useDayNav(shift)
	function toggleKind() {
		setKind((current) => (current === "do" ? "avoid" : "do"))
	}

	// Stable handlers for the memoised rows; `day` is the only state they need.
	const cycle = useCallback(
		(habit, current) => {
			const next = NEXT[current?.value ?? "pending"]
			if (next === null) untick(db, habit.id, day)
			else tick(db, habit.id, day, next)
		},
		[db, day]
	)
	const accept = useCallback((habit, proposal) => tick(db, habit.id, day, proposal.value), [db, day])
	const remove = useCallback((habit) => removeHabit(db, habit.id), [db])

	function add() {
		if (name.trim() === "") return
		addHabit(db, { name, kind })
		setName("")
	}

	function renderHabit({ item }) {
		const strip = days.map((d) => ({
			day: d,
			value: effectiveTick(historyByHabitDay.get(`${item.id}|${d}`) ?? NONE)?.value,
		}))
		return (
			<HabitRow
				habit={item}
				tick={effectiveTick(ticksByHabit.get(item.id) ?? NONE)}
				strip={strip}
				onCycle={cycle}
				onAccept={accept}
				onRemove={remove}
			/>
		)
	}

	return (
		<KeyboardAvoidingView
			behavior={Platform.OS === "ios" ? "padding" : "height"}
			className="flex-1 bg-background"
			style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
		>
			<DateHeadline day={day} section="Habits" onShift={shift} onPick={setDay} />
			<View
				className="m-md flex-1 overflow-hidden rounded-panel border border-outline-variant bg-surface shadow-panel"
				{...pan.panHandlers}
			>
				<FlatList
					data={list}
					keyExtractor={keyOf}
					renderItem={renderHabit}
					ItemSeparatorComponent={Hairline}
					keyboardShouldPersistTaps="handled"
				/>
			</View>
			<View className="flex-row items-center gap-xs border-t border-outline-variant bg-surface px-md py-sm">
				<Input
					className="flex-1"
					value={name}
					onChangeText={setName}
					onSubmitEditing={add}
					submitBehavior="submit"
					placeholder="no porn"
				/>
				<Badge variant="primary" caps onPress={toggleKind}>
					{kind}
				</Badge>
			</View>
		</KeyboardAvoidingView>
	)
}

const NONE = []

function keyOf(habit) {
	return habit.id
}

function Hairline() {
	return <View className="border-t border-outline-variant" />
}

/** rows → Map<key, rows[]>, one pass. */
function groupBy(rows, keyOfRow) {
	const groups = new Map()
	for (const row of rows) {
		const key = keyOfRow(row)
		const group = groups.get(key)
		if (group) group.push(row)
		else groups.set(key, [row])
	}
	return groups
}
