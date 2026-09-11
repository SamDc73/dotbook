import { Pressable, View } from "react-native"
import { Text } from "../components/ui/Text"

// What the error boundary shows when the database cannot be opened — the
// message as it is, and a retry. react-error-boundary supplies both props.
export function DatabaseError({ error, resetErrorBoundary }) {
	return (
		<View className="flex-1 items-center justify-center gap-sm bg-background px-lg">
			<Text variant="subheading">Could not open the log</Text>
			<Text className="text-center text-on-surface-variant">{String(error?.message ?? error)}</Text>
			<Pressable onPress={resetErrorBoundary} className="rounded-lg bg-primary px-md py-xs" accessibilityRole="button">
				<Text className="text-on-primary">Try again</Text>
			</Pressable>
		</View>
	)
}
