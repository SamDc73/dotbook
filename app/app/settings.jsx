import { useRouter } from "expo-router"
import { ChevronLeft } from "lucide-react-native"
import { Pressable, ScrollView, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { RingImportSection } from "../components/RingImportSection"
import { ScreenTimeSection } from "../components/ScreenTimeSection"
import { ServerSettings } from "../components/ServerSettings"
import { Icon } from "../components/ui/Icon"
import { Text } from "../components/ui/Text"

// Settings. Each section is its own component so they can be added one at a time.
export default function Settings() {
	const router = useRouter()
	const insets = useSafeAreaInsets()

	function back() {
		router.back()
	}

	return (
		<View className="flex-1 bg-background" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
			<View className="flex-row items-center gap-sm px-md py-sm">
				<Pressable onPress={back} className="p-xs rounded-md active:bg-surface-container" accessibilityLabel="Back">
					<Icon as={ChevronLeft} className="text-on-surface-variant" />
				</Pressable>
				<Text variant="heading">Settings</Text>
			</View>
			<ScrollView>
				<ServerSettings />
				<ScreenTimeSection />
				<RingImportSection />
			</ScrollView>
		</View>
	)
}
