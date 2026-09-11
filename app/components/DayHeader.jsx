import { useRouter } from "expo-router"
import {
	ChevronLeft,
	ChevronRight,
	CircleCheck,
	Clock,
	Crosshair,
	Layers,
	List,
	ListChecks,
	Repeat,
	Settings,
	TrendingUp,
} from "lucide-react-native"
import { Pressable, Text, View } from "react-native"
import { dayLabel } from "../lib/day"
import { Icon } from "./ui/Icon"

// The day being viewed, and one icon per place the app has. The order toggle
// is the only one that changes this screen; the rest are routes.
const SECTIONS = [
	{ route: "/focus", label: "Focus", glyph: Crosshair },
	{ route: "/templates", label: "Templates", glyph: Layers },
	{ route: "/todos", label: "Todos", glyph: ListChecks },
	{ route: "/habits", label: "Habits", glyph: CircleCheck },
	{ route: "/recurring", label: "Recurring", glyph: Repeat },
	{ route: "/trends", label: "Trends", glyph: TrendingUp },
	{ route: "/settings", label: "Settings", glyph: Settings },
]

export function DayHeader({ day, order, onShiftDay, onToggleOrder }) {
	const router = useRouter()
	const orderGlyph = order === "chronological" ? Clock : List

	function previousDay() {
		onShiftDay(-1)
	}
	function nextDay() {
		onShiftDay(1)
	}

	// Two rows: the day on the first, the places on the second, so six icons
	// still fit beside a date on a phone.
	return (
		<View className="gap-2xs px-sm pt-sm bg-surface">
			<View className="flex-row items-center gap-2xs">
				<HeaderButton label="Previous day" glyph={ChevronLeft} onPress={previousDay} />
				<Text className="flex-1 text-center text-subheading text-on-surface">{dayLabel(day)}</Text>
				<HeaderButton label="Next day" glyph={ChevronRight} onPress={nextDay} />
				<HeaderButton label={`Order: ${order}`} glyph={orderGlyph} onPress={onToggleOrder} className="text-primary" />
			</View>
			<View className="flex-row justify-around border-b border-outline-variant pb-2xs">
				{SECTIONS.map((section) => (
					<HeaderButton
						key={section.route}
						label={section.label}
						glyph={section.glyph}
						onPress={() => router.push(section.route)}
					/>
				))}
			</View>
		</View>
	)
}

function HeaderButton({ label, glyph, onPress, className = "text-on-surface-variant" }) {
	return (
		<Pressable onPress={onPress} className="p-xs rounded-md active:bg-surface-container" accessibilityLabel={label}>
			<Icon as={glyph} className={className} />
		</Pressable>
	)
}
