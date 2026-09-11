import { FlatList, View } from "react-native"

// The template's `.log`, one row at a time: each row carries its own two-pixel
// segment of the gutter in the hour it names (`gutter(hour)` below), so the
// drift — warm at dawn, cool at night — is drawn by the rows themselves and
// stops where they stop; a dashed seam sits between lines, never under the
// last one. Takes FlatList's props; `ref` reaches the list (React 19 passes it
// as a prop) so a screen can scroll to its end. The composer is the log's last
// row: pass it as `ListFooterComponent`.
export function LogList({ ref, ...props }) {
	return (
		<View className="flex-1 px-md">
			<FlatList ref={ref} {...props} className="flex-1" ItemSeparatorComponent={Seam} />
		</View>
	)
}

export function Seam() {
	return <View className="border-b border-dashed border-outline-variant" />
}
