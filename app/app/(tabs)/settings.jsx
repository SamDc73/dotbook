import { ScrollView, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { DataSection } from "../../components/DataSection"
import { RingImportSection } from "../../components/RingImportSection"
import { ScreenHeader } from "../../components/ScreenHeader"
import { ScreenTimeSection } from "../../components/ScreenTimeSection"
import { ServerSettings } from "../../components/ServerSettings"
import { Panel } from "../../components/ui/Panel"

// Settings. Each section is its own component in its own panel, so they can be
// added one at a time.
export default function Settings() {
	const insets = useSafeAreaInsets()

	return (
		<View className="flex-1 bg-background" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
			<ScreenHeader title="Settings" lede="Where the server is, what the phone reports, and what the ring exported" />
			<ScrollView contentContainerClassName="gap-md p-md">
				<Panel eyebrow="Server">
					<ServerSettings />
				</Panel>
				<Panel eyebrow="Screen time">
					<ScreenTimeSection />
				</Panel>
				<Panel eyebrow="RingConn">
					<RingImportSection />
				</Panel>
				<Panel eyebrow="Your data">
					<DataSection />
				</Panel>
			</ScrollView>
		</View>
	)
}
