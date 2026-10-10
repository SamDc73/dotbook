import { Tabs } from "expo-router"
import { View } from "react-native"
import { SectionBar } from "../../components/SectionBar"
import { UndoBar } from "../../components/UndoBar"
import { useWide } from "../../lib/wide"

// The sections are navigation, not a header row. One tab navigator; the bar is
// ours (SectionBar): a left rail with labels past the wide breakpoint, a bottom
// bar with four items on a phone. `tabBarPosition` tells the navigator which
// side to lay the bar on; everything else about it is drawn by SectionBar.
export default function TabsLayout() {
	const wide = useWide()
	return (
		<Tabs
			tabBar={renderSectionBar}
			screenLayout={PageWidth}
			screenOptions={{ headerShown: false, tabBarPosition: wide ? "left" : "bottom", sceneStyle: SCENE }}
		>
			<Tabs.Screen name="index" options={{ title: "Today" }} />
			<Tabs.Screen name="todos" options={{ title: "Todos" }} />
			<Tabs.Screen name="habits" options={{ title: "Habits" }} />
			<Tabs.Screen name="templates" options={{ title: "Templates" }} />
			<Tabs.Screen name="recurring" options={{ title: "Recurring" }} />
			<Tabs.Screen name="trends" options={{ title: "Trends" }} />
			<Tabs.Screen name="settings" options={{ title: "Settings" }} />
			<Tabs.Screen name="more" options={{ title: "More" }} />
		</Tabs>
	)
}

// The navigator calls `tabBar` as a plain function, not a component, so it is
// rendered as an element here — that is what lets SectionBar use hooks.
function renderSectionBar(props) {
	return <SectionBar {...props} />
}

// The navigator paints its own scene background; ours comes from the token.
const SCENE = { backgroundColor: "transparent" }

// Every screen sits in a reading-width column on wide screens, and the page adds
// sm to each screen's own md so the gutter is the next step, lg; on a phone it
// is simply the full width. The undo bar sits at the foot of that column.
function PageWidth({ children }) {
	return (
		<View className="flex-1 items-center bg-background">
			<View className="w-full max-w-page flex-1 wide:px-sm">
				{children}
				<UndoBar />
			</View>
		</View>
	)
}
