import { View } from "react-native"
import { Text } from "./ui/Text"

// The template's `.head`, for a screen that is not day-scoped: the one Fraunces
// heading it gets, a muted lede if it has one, and room for one action. No way
// back — these screens are tabs, reached from the rail or the bar.
export function ScreenHeader({ title, lede = null, children = null }) {
	return (
		<View className="flex-row items-end gap-sm border-b border-outline-variant px-md pt-sm pb-md">
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
