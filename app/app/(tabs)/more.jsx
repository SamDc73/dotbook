import { useRouter } from "expo-router"
import Crosshair from "lucide-react-native/icons/crosshair"
import Layers from "lucide-react-native/icons/layers"
import Repeat from "lucide-react-native/icons/repeat"
import Settings from "lucide-react-native/icons/settings"
import TrendingUp from "lucide-react-native/icons/trending-up"
import { Pressable, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { ScreenHeader } from "../../components/ScreenHeader"
import { Icon } from "../../components/ui/Icon"
import { Text } from "../../components/ui/Text"

// The phone's fourth tab: the places that did not fit in the bar. On wide
// screens the rail lists all of them and this screen is never shown.
const PLACES = [
	{ href: "/focus", label: "Focus", hint: "one block, one line", glyph: Crosshair },
	{ href: "/templates", label: "Templates", hint: "nootstack v1.3 and friends", glyph: Layers },
	{ href: "/recurring", label: "Recurring", hint: "rules that write their own lines", glyph: Repeat },
	{ href: "/trends", label: "Trends", hint: "moved together, not caused", glyph: TrendingUp },
	{ href: "/settings", label: "Settings", hint: "server, screen time, ring", glyph: Settings },
]

export default function More() {
	const router = useRouter()
	const insets = useSafeAreaInsets()
	return (
		<View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
			<ScreenHeader title="More" />
			<View className="px-md">
				{PLACES.map((place) => (
					<Pressable
						key={place.href}
						onPress={() => router.navigate(place.href)}
						className="flex-row items-center gap-md border-b border-dashed border-outline-variant py-sm active:bg-surface-container"
					>
						<Icon as={place.glyph} className="text-on-surface-variant" />
						<View className="flex-1">
							<Text variant="line">{place.label}</Text>
							<Text variant="caption" className="text-on-surface-variant">
								{place.hint}
							</Text>
						</View>
					</Pressable>
				))}
			</View>
		</View>
	)
}
