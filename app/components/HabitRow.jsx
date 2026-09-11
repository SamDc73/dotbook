import { CircleCheck, CircleDashed, CircleSlash } from "lucide-react-native"
import { Pressable, Text, View } from "react-native"
import { Icon } from "./ui/Icon"

// One habit for one day. Shape carries the state — filled ring kept, ring struck
// through broken, dashed ring pending — and the word is printed beside it, so it
// survives with colour removed (AGENTS.md → the palette). A proposal from the
// classifier is a chip and its reasoning; nothing counts them, nothing nags.
export function HabitRow({ habit, tick, strip, onCycle, onAccept, onRemove }) {
	const state = tick?.value ?? "pending"
	const proposed = tick?.by === "llm"

	function cycle() {
		onCycle(habit, tick)
	}
	function accept() {
		onAccept(habit, tick)
	}
	function remove() {
		onRemove(habit)
	}

	return (
		<Pressable onLongPress={remove} className="gap-xs px-md py-xs active:bg-surface-container">
			<View className="flex-row items-center gap-sm">
				<Pressable
					onPress={cycle}
					className="flex-row items-center gap-2xs"
					accessibilityLabel={`${habit.name}: ${state}`}
				>
					<Icon as={GLYPH[state]} className={COLOUR[state]} />
					<Text className={`text-label ${COLOUR[state]}`}>{state}</Text>
				</Pressable>
				<Text className="flex-1 text-body text-on-surface">{habit.name}</Text>
				<Text className="text-caption text-on-surface-variant">{habit.kind}</Text>
				{proposed ? (
					<Pressable onPress={accept} accessibilityLabel="Accept proposal">
						<Text className="rounded-sm bg-tertiary-container px-2xs text-label text-on-tertiary-container">
							proposed
						</Text>
					</Pressable>
				) : null}
			</View>
			{proposed ? <Text className="text-caption text-on-surface-variant">{tick.reasoning}</Text> : null}
			<View className="flex-row gap-3xs">
				{strip.map(({ day, value }) => (
					<View key={day} className={`h-xs w-xs rounded-xs ${SQUARE[value ?? "none"]}`} />
				))}
			</View>
		</Pressable>
	)
}

const GLYPH = { kept: CircleCheck, broken: CircleSlash, pending: CircleDashed }
const COLOUR = { kept: "text-success", broken: "text-error", pending: "text-on-surface-variant" }
const SQUARE = { kept: "bg-success", broken: "bg-error", none: "bg-surface-container-high" }
