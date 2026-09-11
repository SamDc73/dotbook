import { View } from "react-native"
import { cn } from "./cn"
import { Text } from "./Text"

// The template's `.panel`: a surface with a hairline, the soft cyan shadow, and
// an eyebrow as its heading. Sections of a screen are panels; rows inside are not.
export function Panel({ eyebrow, className, children, ...props }) {
	return (
		<View
			className={cn("gap-sm rounded-panel border border-outline-variant bg-surface p-md shadow-panel", className)}
			{...props}
		>
			{eyebrow ? <Text variant="eyebrow">{eyebrow}</Text> : null}
			{children}
		</View>
	)
}
