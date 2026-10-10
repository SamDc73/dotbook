import ChevronLeft from "lucide-react-native/icons/chevron-left"
import { Pressable, View } from "react-native"
import { Icon } from "./ui/Icon"
import { Text } from "./ui/Text"

// The template's `.head`, for a screen that is not day-scoped: the one Fraunces
// title it gets, a muted lede if it has one, and room for one action. `onBack`
// adds a way back for a screen that opens on top of another (a template's
// versions, the login page); tabs have none, they are reached from the rail or
// the bar. The lede sits a 2xs step under the title, the title's own small step.
export function ScreenHeader({ title, lede = null, onBack = null, children = null }) {
	return (
		<View className="flex-row items-end gap-sm border-b border-outline-variant px-md pt-sm pb-sm wide:pt-lg">
			{onBack ? (
				<Pressable
					onPress={onBack}
					className="self-center rounded-full p-xs active:bg-surface-container"
					accessibilityLabel="Back"
				>
					<Icon as={ChevronLeft} className="text-on-surface-variant" />
				</Pressable>
			) : null}
			<View className="flex-1 gap-2xs">
				<Text variant="title">{title}</Text>
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
