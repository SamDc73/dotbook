import Check from "lucide-react-native/icons/check"
import X from "lucide-react-native/icons/x"
import { memo } from "react"
import { Pressable, View } from "react-native"
import { Icon } from "./ui/Icon"
import { Text } from "./ui/Text"

// The uHabits list, yes/no only: one row per habit, one square cell per day,
// newest day at the left beside the name. Shape carries the state — a bold
// check for yes, a light cross for no, a faint question mark for unknown — and
// the colour follows the palette (success / outline / outline-variant), never
// alone. A proposal from the classifier is the same glyph in tertiary inside a
// dashed ring; tapping it accepts it, long-pressing shows why.
//
// Tapping a cell cycles it the way uHabits does: unknown → yes → no → unknown.

/** The header's day columns: weekday over day number, today in primary. */
export function DayHeader({ days, today }) {
	return (
		<View className="flex-row">
			{days.map((day) => (
				<View key={day.day} className="h-cell w-cell items-center justify-center">
					<Text
						variant="caption"
						className={day.day === today ? "font-mono text-primary" : "font-mono text-on-surface-variant"}
					>
						{day.weekday}
					</Text>
					<Text
						variant="caption"
						className={day.day === today ? "font-mono text-primary" : "font-mono text-on-surface-variant"}
					>
						{day.number}
					</Text>
				</View>
			))}
		</View>
	)
}

/** One habit's cells, one per day in `cells` (newest first). Memoised: it sits in a grid. */
export const HabitCells = memo(function HabitCells({ habit, cells, onTap, onHold }) {
	return (
		<View className="h-cell flex-row">
			{cells.map((cell) => (
				<Cell key={cell.day} habit={habit} cell={cell} onTap={onTap} onHold={onHold} />
			))}
		</View>
	)
})

function Cell({ habit, cell, onTap, onHold }) {
	const state = cell.tick?.value ?? "unknown"
	const proposed = cell.tick?.by === "llm"

	function tap() {
		onTap(habit, cell)
	}
	function hold() {
		if (proposed) onHold(habit, cell)
	}

	return (
		<Pressable
			onPress={tap}
			onLongPress={hold}
			accessibilityLabel={`${habit.name} · ${cell.weekday} ${cell.number} · ${WORD[state]}`}
			className={`h-cell w-cell items-center justify-center active:bg-surface-container ${proposed ? "rounded-sm border border-dashed border-tertiary-line" : ""}`}
		>
			<Glyph state={state} proposed={proposed} />
		</Pressable>
	)
}

function Glyph({ state, proposed }) {
	if (state === "kept") {
		return <Icon as={Check} strokeWidth={2.75} className={proposed ? "text-tertiary" : "text-success"} />
	}
	if (state === "broken") {
		return <Icon as={X} strokeWidth={1.5} className={proposed ? "text-tertiary" : "text-outline"} />
	}
	return (
		<Text variant="mono" className="text-outline-variant">
			?
		</Text>
	)
}

// What the cell says of itself, for screen readers and the e2e checks.
const WORD = { kept: "yes", broken: "no", unknown: "unknown" }
