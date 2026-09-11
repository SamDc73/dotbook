import { effectiveTick } from "@dotbook/core/habits"
import { useRouter } from "expo-router"
import { useSQLiteContext } from "expo-sqlite"
import { ChevronLeft, ChevronRight } from "lucide-react-native"
import { useCallback, useState } from "react"
import { FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { HabitRow } from "../components/HabitRow"
import { Icon } from "../components/ui/Icon"
import { addHabit, grid, habits, removeHabit, tick, ticksOn, untick } from "../db/habits"
import { useLiveQuery } from "../db/use-live-query"
import { dayLabel, shiftDay, today } from "../lib/day"

const STRIP_DAYS = 14

// Tapping the glyph walks the person's tick through these; `null` means untick.
const NEXT = { pending: "kept", kept: "broken", broken: null }

// One day of habits. The state shown is `effectiveTick`: a person's tick wins
// over the classifier's while it exists. Proposals are reviewable here and
// nowhere else — no badge, no count. See V0.1 → feature 6.
export default function Habits() {
	const db = useSQLiteContext()
	const router = useRouter()
	const insets = useSafeAreaInsets()
	const [day, setDay] = useState(today)
	const [name, setName] = useState("")
	const [kind, setKind] = useState("do")

	const habitsQuery = useCallback(() => habits(db), [db])
	const list = useLiveQuery(db, habitsQuery)
	const ticksQuery = useCallback(() => ticksOn(db, day), [db, day])
	const ticks = useLiveQuery(db, ticksQuery)
	const stripStart = shiftDay(day, 1 - STRIP_DAYS)
	const gridQuery = useCallback(() => grid(db, stripStart, day), [db, stripStart, day])
	const history = useLiveQuery(db, gridQuery)

	const days = Array.from({ length: STRIP_DAYS }, (_, i) => shiftDay(stripStart, i))

	function back() {
		router.back()
	}
	function previousDay() {
		setDay(shiftDay(day, -1))
	}
	function nextDay() {
		setDay(shiftDay(day, 1))
	}
	function toggleKind() {
		setKind(kind === "do" ? "avoid" : "do")
	}

	function cycle(habit, current) {
		const next = NEXT[current?.value ?? "pending"]
		if (next === null) {
			untick(db, habit.id, day)
			return
		}
		tick(db, habit.id, day, next)
	}
	function accept(habit, proposal) {
		tick(db, habit.id, day, proposal.value)
	}
	function remove(habit) {
		removeHabit(db, habit.id)
	}
	function add() {
		if (name.trim() === "") return
		addHabit(db, { name, kind })
		setName("")
	}

	function renderHabit({ item }) {
		const own = (rows) => rows.filter((row) => row.habit_id === item.id)
		const strip = days.map((d) => ({
			day: d,
			value: effectiveTick(own(history).filter((row) => row.day === d))?.value,
		}))
		return (
			<HabitRow
				habit={item}
				tick={effectiveTick(own(ticks))}
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
			<View className="flex-row items-center gap-sm bg-surface px-md py-sm">
				<Pressable onPress={back} className="rounded-md p-xs active:bg-surface-container" accessibilityLabel="Back">
					<Icon as={ChevronLeft} className="text-on-surface-variant" />
				</Pressable>
				<Text className="text-subheading text-on-surface">Habits</Text>
				<Pressable
					onPress={previousDay}
					className="ml-auto rounded-md p-xs active:bg-surface-container"
					accessibilityLabel="Previous day"
				>
					<Icon as={ChevronLeft} className="text-on-surface-variant" />
				</Pressable>
				<Text className="text-label text-on-surface">{dayLabel(day)}</Text>
				<Pressable
					onPress={nextDay}
					className="rounded-md p-xs active:bg-surface-container"
					accessibilityLabel="Next day"
				>
					<Icon as={ChevronRight} className="text-on-surface-variant" />
				</Pressable>
			</View>
			<FlatList
				data={list}
				keyExtractor={(habit) => habit.id}
				renderItem={renderHabit}
				contentContainerClassName="py-sm"
				keyboardShouldPersistTaps="handled"
			/>
			<View className="flex-row items-center gap-xs bg-surface-container px-md py-sm">
				<TextInput
					className="flex-1 text-body text-on-surface"
					value={name}
					onChangeText={setName}
					onSubmitEditing={add}
					submitBehavior="submit"
					placeholder="no porn"
				/>
				<Pressable onPress={toggleKind} className="rounded-sm bg-primary-container px-2xs py-3xs">
					<Text className="text-label text-on-primary-container">{kind}</Text>
				</Pressable>
			</View>
		</KeyboardAvoidingView>
	)
}
