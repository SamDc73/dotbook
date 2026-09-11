import { View } from "react-native"
import { Text } from "./ui/Text"

// One line of the correlations and with-vs-without sections: what was
// compared on the left, the figure on the right.
export function StatRow({ label, value }) {
	return (
		<View className="flex-row items-baseline justify-between gap-sm border-t border-outline-variant py-xs">
			<Text variant="line" className="flex-1">
				{label}
			</Text>
			<Text variant="data">{value}</Text>
		</View>
	)
}
