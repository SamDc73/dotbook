import CircleCheck from "lucide-react-native/icons/circle-check"
import CircleDashed from "lucide-react-native/icons/circle-dashed"
import CircleSlash from "lucide-react-native/icons/circle-slash"
import { memo } from "react"
import { Pressable, View } from "react-native"
import { Badge } from "./ui/Badge"
import { Icon } from "./ui/Icon"
import { Text } from "./ui/Text"

// One habit for one day, as the template's `.hab` row: glyph, name, the line
// that produced the verdict, the verdict as a small uppercase chip — on a wash
// of the state's colour. Shape carries the state (filled ring kept, ring struck
// through broken, dashed ring pending) and the word is printed, so it survives
// with colour removed. A proposal from the classifier is the same row with a
// `proposed` chip beside its reasoning; nothing counts them, nothing nags.
// Memoised: it sits in a list.
export const HabitRow = memo(function HabitRow({ habit, tick, strip, onCycle, onAccept, onRemove }) {
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
		<Pressable onLongPress={remove} className={`gap-xs px-md py-sm ${WASH[state]}`}>
			<View className="flex-row items-center gap-md">
				<Pressable onPress={cycle} accessibilityLabel={`${habit.name}: ${state}`}>
					<Icon as={GLYPH[state]} className={COLOUR[state]} />
				</Pressable>
				<Text variant="line" className="flex-1">
					{habit.name}
				</Text>
				{proposed ? (
					<Text variant="data" className="flex-1" numberOfLines={1}>
						{tick.reasoning}
					</Text>
				) : (
					<Text variant="data" className="flex-1">
						{habit.kind}
					</Text>
				)}
				{proposed ? (
					<Badge variant="tertiary" caps onPress={accept} accessibilityLabel="Accept proposal">
						proposed
					</Badge>
				) : null}
				<Badge variant={CHIP[state]} caps onPress={cycle}>
					{WORD[state]}
				</Badge>
			</View>
			<View className="flex-row gap-3xs pl-xl">
				{strip.map(({ day, value }) => (
					<View key={day} className={`h-xs w-xs rounded-xs ${SQUARE[value ?? "none"]}`} />
				))}
			</View>
		</Pressable>
	)
})

const GLYPH = { kept: CircleCheck, broken: CircleSlash, pending: CircleDashed }
const COLOUR = { kept: "text-success", broken: "text-error", pending: "text-warning" }
const WASH = { kept: "bg-success-wash", broken: "bg-error-wash", pending: "bg-warning-wash" }
const CHIP = { kept: "success", broken: "error", pending: "warning" }
const WORD = { kept: "kept", broken: "broken", pending: "not yet" }
const SQUARE = { kept: "bg-success", broken: "bg-error", none: "bg-surface-container-high" }
