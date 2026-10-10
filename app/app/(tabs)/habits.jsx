import { effectiveTick } from "@dotbook/core/habits"
import { useSQLiteContext } from "expo-sqlite"
import { useCallback, useMemo, useState } from "react"
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { DayHeader, HabitCells } from "../../components/HabitGrid"
import { ScreenHeader } from "../../components/ScreenHeader"
import { Badge } from "../../components/ui/Badge"
import { Input } from "../../components/ui/Input"
import { Text } from "../../components/ui/Text"
import { addHabit, cycleTick, grid, habits, removeHabit, restoreHabit } from "../../db/habits"
import { useLiveQuery } from "../../db/use-live-query"
import { shiftDay } from "../../lib/day"
import { weekday } from "../../lib/format"
import { tap } from "../../lib/haptics"
import { offerUndo } from "../../lib/undo"
import { useToday } from "../../lib/use-today"

// Four weeks of cells; older days scroll in from the right.
const DAYS = 28

// Habits as uHabits lays them out: names in a fixed column, a square cell per
// day to their right, newest day first, the whole day panel scrolling sideways
// under one header. The state shown is `effectiveTick`: a person's tick wins
// over the classifier's while it exists. Nothing counts proposals, nothing nags.
export default function Habits() {
	const db = useSQLiteContext()
	const insets = useSafeAreaInsets()
	const [name, setName] = useState("")
	const [kind, setKind] = useState("do")
	const [why, setWhy] = useState(null) // a proposal's reasoning, shown on long-press

	const day = useToday()
	const days = useMemo(() => columns(day), [day])
	const list = useLiveQuery(["habits"], () => habits(db))
	const history = useLiveQuery(["habit-grid", days.at(-1).day, day], () => grid(db, days.at(-1).day, day))

	// One index for the whole grid, rebuilt only when the ticks change: each
	// habit's cells are a stable array, so a memoised row skips its render.
	const cellsByHabit = useMemo(() => {
		const byKey = groupBy(history, (row) => `${row.habit_id}|${row.day}`)
		const byHabit = new Map()
		for (const habit of list) {
			byHabit.set(
				habit.id,
				days.map((column) => ({ ...column, tick: effectiveTick(byKey.get(`${habit.id}|${column.day}`) ?? NONE) }))
			)
		}
		return byHabit
	}, [history, list, days])

	const press = useCallback(
		async (habit, cell) => tap((await cycleTick(db, habit.id, cell.day, cell.tick)) ?? "undone"),
		[db]
	)
	const hold = useCallback((habit, cell) => setWhy({ habit, cell }), [])
	const remove = useCallback(
		(habit) => {
			removeHabit(db, habit.id)
			offerUndo("Habit removed", () => restoreHabit(db, habit.id))
		},
		[db]
	)

	function toggleKind() {
		setKind((current) => (current === "do" ? "avoid" : "do"))
	}
	function add() {
		if (name.trim() === "") return
		addHabit(db, { name, kind })
		setName("")
	}
	function dismissWhy() {
		setWhy(null)
	}

	return (
		<KeyboardAvoidingView
			behavior={Platform.OS === "ios" ? "padding" : "height"}
			className="flex-1 bg-background"
			style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
		>
			<ScreenHeader title="Habits" lede="tap a day to cycle it: yes, no, unknown" />
			<ScrollView className="flex-1" contentContainerClassName="p-md" keyboardShouldPersistTaps="handled">
				{list.length === 0 ? (
					<Text variant="line" className="text-on-surface-variant">
						No habits yet. Name one below; tap DO to make it one to avoid.
					</Text>
				) : (
					<View className="flex-row overflow-hidden rounded-md border border-outline-variant bg-surface shadow-panel">
						<View className="w-habitname border-r border-outline-variant">
							<View className="h-cell" />
							{list.map((habit) => (
								<NameCell key={habit.id} habit={habit} onRemove={remove} />
							))}
						</View>
						<ScrollView horizontal showsHorizontalScrollIndicator={false}>
							<View>
								<DayHeader days={days} today={day} />
								{list.map((habit) => (
									<HabitCells
										key={habit.id}
										habit={habit}
										cells={cellsByHabit.get(habit.id) ?? NONE}
										onTap={press}
										onHold={hold}
									/>
								))}
							</View>
						</ScrollView>
					</View>
				)}
				{why ? <Reasoning why={why} onDismiss={dismissWhy} /> : null}
			</ScrollView>
			<View className="flex-row items-center gap-xs border-t border-outline-variant bg-surface px-md py-sm">
				<Input
					className="flex-1"
					value={name}
					onChangeText={setName}
					onSubmitEditing={add}
					submitBehavior="submit"
					placeholder="no porn"
				/>
				<Badge variant="primary" caps onPress={toggleKind} accessibilityLabel={`kind: ${kind}`}>
					{kind}
				</Badge>
			</View>
		</KeyboardAvoidingView>
	)
}

// The name and its kind, in the fixed column; long-press removes (soft).
function NameCell({ habit, onRemove }) {
	function remove() {
		onRemove(habit)
	}
	return (
		<Pressable onLongPress={remove} className="h-cell justify-center px-sm active:bg-surface-container">
			<Text variant="line" numberOfLines={1}>
				{habit.name}
			</Text>
			<Text variant="data">{habit.kind}</Text>
		</Pressable>
	)
}

// Why the classifier proposed what it did, for the cell that was held.
function Reasoning({ why, onDismiss }) {
	const { habit, cell } = why
	return (
		<Pressable
			onPress={onDismiss}
			className="mt-md gap-2xs rounded-md border border-tertiary-line bg-tertiary-wash px-md py-sm"
		>
			<Text variant="eyebrow">
				{habit.name} · {cell.weekday} {cell.number} · proposed
			</Text>
			<Text variant="data">{cell.tick?.reasoning ?? "no reasoning recorded"}</Text>
		</Pressable>
	)
}

const NONE = []

/** Today and the 27 days before it, newest first, with the header's two lines ready. */
function columns(day) {
	return Array.from({ length: DAYS }, (_, i) => {
		const d = shiftDay(day, -i)
		return { day: d, weekday: weekday(d), number: d.slice(8) }
	})
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
