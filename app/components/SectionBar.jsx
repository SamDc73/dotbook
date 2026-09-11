import { useRouter } from "expo-router"
import CircleCheck from "lucide-react-native/icons/circle-check"
import Crosshair from "lucide-react-native/icons/crosshair"
import Ellipsis from "lucide-react-native/icons/ellipsis"
import Layers from "lucide-react-native/icons/layers"
import ListChecks from "lucide-react-native/icons/list-checks"
import NotebookPen from "lucide-react-native/icons/notebook-pen"
import Repeat from "lucide-react-native/icons/repeat"
import Settings from "lucide-react-native/icons/settings"
import TrendingUp from "lucide-react-native/icons/trending-up"
import { Pressable, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useWide } from "../lib/wide"
import { Icon } from "./ui/Icon"
import { Text } from "./ui/Text"

// The template's rail on wide screens, the phone's bottom bar below it — from
// one list of places. The rail shows everything; a phone bar holds four, so the
// rest live behind More. The active item is primary, with a 2px rule on the
// edge that touches the content: left on the rail, top on the bar.

const PLACES = [
	{ name: "index", href: "/", label: "Today", glyph: NotebookPen },
	{ name: "todos", href: "/todos", label: "Todos", glyph: ListChecks },
	{ name: "habits", href: "/habits", label: "Habits", glyph: CircleCheck },
	{ name: "focus", href: "/focus", label: "Focus", glyph: Crosshair },
	{ name: "templates", href: "/templates", label: "Templates", glyph: Layers },
	{ name: "recurring", href: "/recurring", label: "Recurring", glyph: Repeat },
	{ name: "trends", href: "/trends", label: "Trends", glyph: TrendingUp },
	{ name: "settings", href: "/settings", label: "Settings", glyph: Settings },
]
const PHONE = ["index", "todos", "habits"]
const MORE = { name: "more", href: "/more", label: "More", glyph: Ellipsis }

export function SectionBar({ state }) {
	const wide = useWide()
	const current = state.routes[state.index].name
	if (wide) return <Rail current={current} />
	return <Bar current={current} />
}

function Rail({ current }) {
	const insets = useSafeAreaInsets()
	return (
		<View className="gap-3xs border-r border-outline-variant bg-surface px-sm py-md" style={{ paddingTop: insets.top }}>
			<Text variant="heading" className="px-sm pb-md">
				Dotbook
			</Text>
			{PLACES.map((place) => (
				<RailItem key={place.name} place={place} active={place.name === current} />
			))}
		</View>
	)
}

function RailItem({ place, active }) {
	const router = useRouter()
	return (
		<Pressable
			onPress={() => router.navigate(place.href)}
			accessibilityRole="tab"
			accessibilityState={{ selected: active }}
			className={
				active
					? "flex-row items-center gap-sm rounded-seg bg-primary-wash px-sm py-xs"
					: "flex-row items-center gap-sm rounded-seg px-sm py-xs active:bg-surface-container"
			}
		>
			<View className={active ? "absolute left-0 h-full w-3xs rounded-full bg-primary" : "hidden"} />
			<Icon as={place.glyph} className={active ? "text-primary" : "text-on-surface-variant"} />
			<Text variant="eyebrow" className={active ? "text-primary" : undefined}>
				{place.label}
			</Text>
		</Pressable>
	)
}

function Bar({ current }) {
	const insets = useSafeAreaInsets()
	const items = PLACES.filter((place) => PHONE.includes(place.name))
	// Anything not in the bar is reached through More, which then reads as active.
	const moreActive = !PHONE.includes(current)
	return (
		<View className="flex-row border-t border-outline-variant bg-surface" style={{ paddingBottom: insets.bottom }}>
			{items.map((place) => (
				<BarItem key={place.name} place={place} active={place.name === current} />
			))}
			<BarItem place={MORE} active={moreActive} />
		</View>
	)
}

function BarItem({ place, active }) {
	const router = useRouter()
	return (
		<Pressable
			onPress={() => router.navigate(place.href)}
			accessibilityRole="tab"
			accessibilityState={{ selected: active }}
			className={
				active
					? "flex-1 items-center gap-3xs border-t-2 border-primary pt-xs pb-2xs"
					: "flex-1 items-center gap-3xs border-t-2 border-transparent pt-xs pb-2xs active:bg-surface-container"
			}
		>
			<Icon as={place.glyph} className={active ? "text-primary" : "text-on-surface-variant"} />
			<Text variant="caption" className={active ? "font-body-semibold text-primary" : "text-on-surface-variant"}>
				{place.label}
			</Text>
		</Pressable>
	)
}
