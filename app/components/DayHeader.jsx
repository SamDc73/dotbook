import { useRouter } from "expo-router"
import { ChevronLeft, ChevronRight, Clock, Layers, List, ListChecks } from "lucide-react-native"
import { styled } from "nativewind"
import { Pressable, Text, View } from "react-native"
import { dayLabel } from "../lib/day"

// Lucide icons take their colour as a prop; this lets a token class drive it instead.
const ICON = { className: { target: "style", nativeStyleMapping: { color: "color" } } }
const PrevIcon = styled(ChevronLeft, ICON)
const NextIcon = styled(ChevronRight, ICON)
const ChronologicalIcon = styled(Clock, ICON)
const TypingIcon = styled(List, ICON)
const TemplatesIcon = styled(Layers, ICON)
const TodosIcon = styled(ListChecks, ICON)

export function DayHeader({ day, order, onShiftDay, onToggleOrder }) {
	const OrderIcon = order === "chronological" ? ChronologicalIcon : TypingIcon
	const router = useRouter()

	function previousDay() {
		onShiftDay(-1)
	}
	function nextDay() {
		onShiftDay(1)
	}
	function openTemplates() {
		router.push("/templates")
	}
	function openTodos() {
		router.push("/todos")
	}

	return (
		<View className="flex-row items-center gap-sm px-md py-sm bg-surface">
			<Pressable
				onPress={previousDay}
				className="p-xs rounded-md active:bg-surface-container"
				accessibilityLabel="Previous day"
			>
				<PrevIcon className="text-on-surface-variant" />
			</Pressable>
			<Text className="flex-1 text-center text-subheading text-on-surface">{dayLabel(day)}</Text>
			<Pressable
				onPress={nextDay}
				className="p-xs rounded-md active:bg-surface-container"
				accessibilityLabel="Next day"
			>
				<NextIcon className="text-on-surface-variant" />
			</Pressable>
			<Pressable
				onPress={onToggleOrder}
				className="p-xs rounded-md active:bg-surface-container"
				accessibilityLabel={`Order: ${order}`}
			>
				<OrderIcon className="text-primary" />
			</Pressable>
			<Pressable
				onPress={openTemplates}
				className="p-xs rounded-md active:bg-surface-container"
				accessibilityLabel="Templates"
			>
				<TemplatesIcon className="text-on-surface-variant" />
			</Pressable>
			<Pressable onPress={openTodos} className="p-xs rounded-md active:bg-surface-container" accessibilityLabel="Todos">
				<TodosIcon className="text-on-surface-variant" />
			</Pressable>
		</View>
	)
}
