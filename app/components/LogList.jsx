import { LinearGradient } from "expo-linear-gradient"
import { FlatList, View } from "react-native"
import { useTokenColour } from "../lib/use-token-colour"

// The template's `.log`: a two-pixel drift line down the gutter — the hour tints
// from dawn to night, so the day has a temperature — and a dashed seam between
// lines, never under the last one. Takes FlatList's props.
export function LogList(props) {
	// expo-linear-gradient wants its stops as JavaScript values. They come through
	// the sanctioned live-variable hook, so they still follow the theme and
	// Material You instead of freezing a hex here.
	const dawn = useTokenColour("--color-hour-07")
	const morning = useTokenColour("--color-hour-09")
	const noon = useTokenColour("--color-hour-12")
	const afternoon = useTokenColour("--color-hour-14")
	const dusk = useTokenColour("--color-hour-18")
	const night = useTokenColour("--color-hour-22")

	return (
		<View className="flex-1 flex-row px-md">
			<View className="my-sm w-3xs overflow-hidden rounded-full">
				<LinearGradient colors={[dawn, morning, noon, afternoon, dusk, night]} style={FILL} />
			</View>
			<FlatList {...props} className="flex-1 pl-md" ItemSeparatorComponent={Seam} />
		</View>
	)
}

// The gradient fills its two-pixel column; a layout value, not a design one.
const FILL = { flex: 1 }

function Seam() {
	return <View className="border-b border-dashed border-outline-variant" />
}
