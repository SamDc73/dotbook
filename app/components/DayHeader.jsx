import { usePathname, useRouter } from "expo-router"
import ChevronLeft from "lucide-react-native/icons/chevron-left"
import ChevronRight from "lucide-react-native/icons/chevron-right"
import CircleCheck from "lucide-react-native/icons/circle-check"
import Clock from "lucide-react-native/icons/clock"
import Crosshair from "lucide-react-native/icons/crosshair"
import Layers from "lucide-react-native/icons/layers"
import List from "lucide-react-native/icons/list"
import ListChecks from "lucide-react-native/icons/list-checks"
import Repeat from "lucide-react-native/icons/repeat"
import Settings from "lucide-react-native/icons/settings"
import TrendingUp from "lucide-react-native/icons/trending-up"
import { Pressable, View } from "react-native"
import { dayLabel } from "../lib/day"
import { Icon } from "./ui/Icon"
import { Text } from "./ui/Text"

// The day being viewed, and one icon per place the app has. The order toggle
// is the only one that changes this screen; the rest are routes, laid out as
// the template's segmented control: one hairline box, dividers between cells,
// the pressed cell filled with the primary colour.
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
	const pathname = usePathname()
	const orderGlyph = order === "chronological" ? Clock : List

	function previousDay() {
		onShiftDay(-1)
	}
	function nextDay() {
		onShiftDay(1)
	}

	return (
		<View className="gap-sm border-b border-outline-variant bg-background px-md pt-sm pb-md">
			<View className="flex-row items-center gap-2xs">
				<HeaderButton label="Previous day" glyph={ChevronLeft} onPress={previousDay} />
				<Text variant="heading" className="flex-1 text-center">
					{dayLabel(day)}
				</Text>
				<HeaderButton label="Next day" glyph={ChevronRight} onPress={nextDay} />
				<HeaderButton label={`Order: ${order}`} glyph={orderGlyph} onPress={onToggleOrder} className="text-primary" />
			</View>
			<View className="flex-row overflow-hidden rounded-seg border border-outline-variant bg-surface">
				{SECTIONS.map((section, i) => {
					const pressed = pathname === section.route
					return (
						<Pressable
							key={section.route}
							onPress={() => router.push(section.route)}
							accessibilityLabel={section.label}
							accessibilityState={{ selected: pressed }}
							className={cellClass(pressed, i === 0)}
						>
							<Icon as={section.glyph} className={pressed ? "text-on-primary" : "text-on-surface-variant"} />
						</Pressable>
					)
				})}
			</View>
		</View>
	)
}

function cellClass(pressed, first) {
	const divider = first ? "" : "border-l border-outline-variant"
	const fill = pressed ? "bg-primary" : "active:bg-surface-container"
	return `flex-1 items-center py-xs ${divider} ${fill}`
}

function HeaderButton({ label, glyph, onPress, className = "text-on-surface-variant" }) {
	return (
		<Pressable onPress={onPress} className="rounded-md p-xs active:bg-surface-container" accessibilityLabel={label}>
			<Icon as={glyph} className={className} />
		</Pressable>
	)
}
