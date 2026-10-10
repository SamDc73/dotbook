import { useRouter } from "expo-router"
import { Pressable, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useWide } from "../lib/wide"
import {
	FocusGlyph,
	HabitGlyph,
	MoreGlyph,
	RecurringGlyph,
	SettingsGlyph,
	TemplatesGlyph,
	TodayGlyph,
	TodoGlyph,
	TrendsGlyph,
} from "./icons/Glyphs"
import { Icon } from "./ui/Icon"
import { Text } from "./ui/Text"
import { Wordmark } from "./Wordmark"

// The palette page's rail on wide screens and its phone bar below the
// breakpoint, drawn from one list of places. The rail is φ⁵ wide on the surface
// with a right hairline, the ./dotbook wordmark, items in the body face at line
// size, padded above and below by navitem and turned at the same (radius-item),
// icon and label an xs apart, the active one on the primary wash in primary,
// semibold — no rule, no uppercase. The bar is the surface with a top hairline,
// an icon above a caption, active in primary.

const PLACES = [
	{ name: "index", href: "/", label: "Today", glyph: TodayGlyph },
	{ name: "todos", href: "/todos", label: "Todos", glyph: TodoGlyph },
	{ name: "habits", href: "/habits", label: "Habits", glyph: HabitGlyph },
	{ name: "focus", href: "/focus", label: "Focus", glyph: FocusGlyph },
	{ name: "templates", href: "/templates", label: "Templates", glyph: TemplatesGlyph },
	{ name: "recurring", href: "/recurring", label: "Recurring", glyph: RecurringGlyph },
	{ name: "trends", href: "/trends", label: "Trends", glyph: TrendsGlyph },
	{ name: "settings", href: "/settings", label: "Settings", glyph: SettingsGlyph },
]
const PHONE = ["index", "todos", "habits"]
const MORE = { name: "more", href: "/more", label: "More", glyph: MoreGlyph }

export function SectionBar({ state }) {
	const wide = useWide()
	const current = state.routes[state.index].name
	if (wide) return <Rail current={current} />
	return <Bar current={current} />
}

function Rail({ current }) {
	const insets = useSafeAreaInsets()
	return (
		<View
			className="w-rail gap-3xs border-r border-outline-variant bg-surface px-sm py-md"
			style={{ paddingTop: insets.top }}
		>
			<Wordmark className="mx-sm mb-md h-md self-start" />
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
					? "flex-row items-center gap-xs rounded-item bg-primary-wash px-sm py-navitem"
					: "flex-row items-center gap-xs rounded-item px-sm py-navitem active:bg-surface-container"
			}
		>
			<Icon as={place.glyph} className={active ? "text-primary" : "text-on-surface-variant"} />
			<Text variant="line" className={active ? "font-body-semibold text-primary" : "text-on-surface-variant"}>
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
		<View
			className="flex-row border-t border-outline-variant bg-surface px-2xs pt-xs pb-sm"
			style={{ paddingBottom: insets.bottom }}
		>
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
			className="flex-1 items-center gap-3xs rounded-item py-xs active:bg-surface-container"
		>
			<Icon as={place.glyph} className={active ? "text-primary" : "text-on-surface-variant"} />
			<Text variant="caption" className={active ? "font-body-semibold text-primary" : "text-on-surface-variant"}>
				{place.label}
			</Text>
		</Pressable>
	)
}
