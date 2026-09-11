import { useRouter } from "expo-router"
import ChevronLeft from "lucide-react-native/icons/chevron-left"
import { Pressable, View } from "react-native"
import { Icon } from "./ui/Icon"
import { Text } from "./ui/Text"

// The template's `.head`, for every screen but Today: the one Fraunces heading a
// screen gets, a muted lede if it has one, a way back, and room for one action.
export function ScreenHeader({ title, lede = null, onBack, children = null }) {
	const router = useRouter()

	function back() {
		if (onBack) onBack()
		else router.back()
	}

	return (
		<View className="flex-row items-end gap-sm border-b border-outline-variant px-md pt-sm pb-md">
			<Pressable onPress={back} className="rounded-md p-xs active:bg-surface-container" accessibilityLabel="Back">
				<Icon as={ChevronLeft} className="text-on-surface-variant" />
			</Pressable>
			<View className="flex-1 gap-3xs">
				<Text variant="heading">{title}</Text>
				{lede ? (
					<Text variant="label" className="text-on-surface-variant">
						{lede}
					</Text>
				) : null}
			</View>
			{children}
		</View>
	)
}
